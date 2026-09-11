import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  NotFoundException,
  Param,
  Post,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';
import {
  Race,
  RaceGroup,
  RaceStatus,
  Registration,
  RegStatus,
  RiderProfile,
  Role,
  TimelineType,
  User,
} from '../entities';
import { CurrentUser, Roles } from '../auth/guards';
import { TimelineService } from '../timeline/timeline.module';

class SubmitDto {
  @IsString() @IsNotEmpty() raceId: string;
  @IsString() @IsNotEmpty() groupId: string;
}

class ReviewDto {
  @IsString() @IsNotEmpty() action: string; // approve / reject
  @IsString() @IsOptional() note?: string;
}

const RISK_RANK: Record<string, number> = { LOW: 0, MEDIUM: 1, HIGH: 2 };

export function calcAge(birthDate: string, onDate: string): number {
  const b = new Date(birthDate);
  const d = new Date(onDate);
  let age = d.getFullYear() - b.getFullYear();
  const m = d.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && d.getDate() < b.getDate())) age--;
  return age;
}

/** 医疗风险评估：年龄 + 健康申报 */
export function computeMedicalRisk(profile: RiderProfile, raceDate: string): string {
  let score = 0;
  const age = calcAge(profile.birthDate, raceDate);
  if (age >= 55) score += 1;
  if (age >= 65) score += 2;
  const cond = (profile.healthConditions || '').trim();
  if (/心脏|heart|高血压|hypertension|癫痫|epilep|哮喘|asthma|糖尿病|diabetes|冠心病/i.test(cond)) score += 2;
  else if (cond) score += 1;
  if (score >= 3) return 'HIGH';
  if (score >= 1) return 'MEDIUM';
  return 'LOW';
}

@Controller('registrations')
export class RegistrationsController {
  constructor(
    @InjectRepository(Registration) private registrations: Repository<Registration>,
    @InjectRepository(Race) private races: Repository<Race>,
    @InjectRepository(RaceGroup) private groups: Repository<RaceGroup>,
    @InjectRepository(RiderProfile) private profiles: Repository<RiderProfile>,
    @InjectRepository(User) private users: Repository<User>,
    private timeline: TimelineService,
  ) {}

  /** 选手提交报名：系统根据组别规则/人数上限/保险要求/医疗风险自动生成报名状态 */
  @Roles(Role.RIDER)
  @Post()
  async submit(@CurrentUser() user: any, @Body() dto: SubmitDto) {
    const race = await this.races.findOne({ where: { id: dto.raceId } });
    if (!race) throw new NotFoundException('赛事不存在');
    if (race.status !== RaceStatus.REGISTRATION_OPEN) {
      throw new BadRequestException('该赛事当前不在报名期');
    }
    const group = await this.groups.findOne({ where: { id: dto.groupId, raceId: race.id } });
    if (!group) throw new NotFoundException('组别不存在');
    const profile = await this.profiles.findOne({ where: { userId: user.id } });
    if (!profile) throw new BadRequestException('请先完善选手资料（证件、健康承诺、紧急联系人等）再报名');

    const existing = await this.registrations.findOne({ where: { raceId: race.id, riderId: user.id } });
    if (existing && ![RegStatus.CANCELLED, RegStatus.REJECTED].includes(existing.status)) {
      throw new BadRequestException('您已报名该赛事，请勿重复提交');
    }

    const evaluation = await this.evaluate(profile, group, race);
    let reg: Registration;
    if (existing) {
      reg = existing;
    } else {
      reg = this.registrations.create({ raceId: race.id, riderId: user.id, groupId: group.id });
    }
    reg.groupId = group.id;
    reg.status = evaluation.status;
    reg.decisionReason = evaluation.reason;
    reg.medicalRisk = evaluation.medicalRisk;
    reg.reviewNote = '';
    if (evaluation.status === RegStatus.APPROVED) {
      await this.assignBib(reg, group);
    } else {
      reg.bibNumber = '';
      reg.chipId = '';
    }
    reg = await this.registrations.save(reg);
    await this.timeline.add(
      race.id,
      TimelineType.REGISTRATION,
      `${user.displayName} 报名「${group.name}」→ ${evaluation.status}${evaluation.reason ? `（${evaluation.reason}）` : ''}`,
      { actorId: user.id, actorName: user.displayName, groupIds: [group.id], refType: 'registration', refId: reg.id },
    );
    return this.enrich(reg);
  }

  /** 评估逻辑：返回报名状态与原因 */
  private async evaluate(
    profile: RiderProfile,
    group: RaceGroup,
    race: Race,
  ): Promise<{ status: RegStatus; reason: string; medicalRisk: string }> {
    const rejections: string[] = [];
    const age = calcAge(profile.birthDate, race.raceDate);

    if (!profile.healthCommitment) rejections.push('未签署健康承诺');
    if (age < group.minAge || age > group.maxAge) {
      rejections.push(`年龄 ${age} 岁不在组别要求 ${group.minAge}-${group.maxAge} 岁范围内`);
    }
    if (!group.allowedVehicleTypes.includes(profile.vehicleType)) {
      rejections.push(`车辆类型 ${profile.vehicleType} 不符合组别要求（允许：${group.allowedVehicleTypes.join('/')}）`);
    }
    if (profile.experienceYears < group.minExperienceYears) {
      rejections.push(`骑行经验 ${profile.experienceYears} 年不足组别要求的 ${group.minExperienceYears} 年`);
    }
    if (group.requiresInsurance) {
      const valid = profile.insurancePolicyNo && profile.insuranceValidUntil && profile.insuranceValidUntil >= race.raceDate;
      if (!valid) rejections.push('保险缺失或有效期未覆盖比赛日');
    }
    const medicalRisk = computeMedicalRisk(profile, race.raceDate);
    if (RISK_RANK[medicalRisk] > RISK_RANK[group.maxMedicalRisk]) {
      rejections.push(`医疗风险评估为 ${medicalRisk}，超出组别允许的最高等级 ${group.maxMedicalRisk}`);
    }

    if (rejections.length) {
      return { status: RegStatus.REJECTED, reason: rejections.join('；'), medicalRisk };
    }
    // 人数上限 → 候补
    const approved = await this.registrations.count({ where: { groupId: group.id, status: RegStatus.APPROVED } });
    if (approved >= group.capacity) {
      return { status: RegStatus.WAITLISTED, reason: `组别已达人数上限 ${group.capacity}，进入候补队列`, medicalRisk };
    }
    return { status: RegStatus.APPROVED, reason: '自动审核通过', medicalRisk };
  }

  private async assignBib(reg: Registration, group: RaceGroup) {
    if (reg.bibNumber) return;
    const count = await this.registrations.count({ where: { groupId: group.id, status: RegStatus.APPROVED } });
    reg.bibNumber = `${group.code}${String(count + 1).padStart(3, '0')}`;
    reg.chipId = `CHIP-${reg.bibNumber}`;
  }

  /** 运营人工审核（可覆盖系统判定） */
  @Roles(Role.OPS)
  @Post(':id/review')
  async review(@Param('id') id: string, @Body() dto: ReviewDto, @CurrentUser() user: any) {
    const reg = await this.registrations.findOne({ where: { id } });
    if (!reg) throw new NotFoundException('报名记录不存在');
    const group = await this.groups.findOne({ where: { id: reg.groupId } });
    if (dto.action === 'approve') {
      if (reg.status === RegStatus.APPROVED) throw new BadRequestException('该报名已是通过状态');
      const approved = await this.registrations.count({ where: { groupId: reg.groupId, status: RegStatus.APPROVED } });
      if (approved >= group.capacity) throw new BadRequestException(`组别已满（${group.capacity} 人），无法通过`);
      reg.status = RegStatus.APPROVED;
      await this.assignBib(reg, group);
    } else if (dto.action === 'reject') {
      reg.status = RegStatus.REJECTED;
      reg.bibNumber = '';
      reg.chipId = '';
    } else {
      throw new BadRequestException('action 必须是 approve 或 reject');
    }
    reg.reviewNote = dto.note || '';
    reg.reviewedById = user.id;
    reg.reviewedAt = new Date();
    await this.registrations.save(reg);
    await this.timeline.add(
      reg.raceId,
      TimelineType.REGISTRATION,
      `人工审核：${user.displayName} 将报名 ${reg.bibNumber || reg.id.slice(0, 8)} 置为 ${reg.status}${dto.note ? `（${dto.note}）` : ''}`,
      { actorId: user.id, actorName: user.displayName, groupIds: [reg.groupId], refType: 'registration', refId: reg.id },
    );
    if (dto.action === 'reject') await this.promoteWaitlist(reg.groupId, user);
    return this.enrich(reg);
  }

  /** 选手取消报名 */
  @Roles(Role.RIDER)
  @Post(':id/cancel')
  async cancel(@Param('id') id: string, @CurrentUser() user: any) {
    const reg = await this.registrations.findOne({ where: { id } });
    if (!reg || reg.riderId !== user.id) throw new NotFoundException('报名记录不存在');
    const race = await this.races.findOne({ where: { id: reg.raceId } });
    if ([RaceStatus.FINISHED, RaceStatus.ARCHIVED].includes(race.status)) {
      throw new BadRequestException('赛事已结束，不能取消报名');
    }
    const wasApproved = reg.status === RegStatus.APPROVED;
    reg.status = RegStatus.CANCELLED;
    reg.bibNumber = '';
    reg.chipId = '';
    await this.registrations.save(reg);
    await this.timeline.add(reg.raceId, TimelineType.REGISTRATION, `${user.displayName} 取消了报名`, {
      actorId: user.id,
      actorName: user.displayName,
      groupIds: [reg.groupId],
      refType: 'registration',
      refId: reg.id,
    });
    if (wasApproved) await this.promoteWaitlist(reg.groupId, user);
    return reg;
  }

  /** 候补递补：有名额空出时按提交顺序递补 */
  private async promoteWaitlist(groupId: string, actor: any) {
    const group = await this.groups.findOne({ where: { id: groupId } });
    const approved = await this.registrations.count({ where: { groupId, status: RegStatus.APPROVED } });
    if (approved >= group.capacity) return;
    const next = await this.registrations.findOne({
      where: { groupId, status: RegStatus.WAITLISTED },
      order: { submittedAt: 'ASC' },
    });
    if (!next) return;
    next.status = RegStatus.APPROVED;
    next.decisionReason = '候补递补通过';
    await this.assignBib(next, group);
    await this.registrations.save(next);
    await this.timeline.add(next.raceId, TimelineType.REGISTRATION, `候补递补：号码 ${next.bibNumber} 进入「${group.name}」`, {
      actorId: actor.id,
      actorName: actor.displayName,
      groupIds: [groupId],
      refType: 'registration',
      refId: next.id,
    });
  }

  /** 我的报名列表 */
  @Roles(Role.RIDER)
  @Get('mine')
  async mine(@CurrentUser() user: any) {
    const regs = await this.registrations.find({ where: { riderId: user.id }, order: { submittedAt: 'DESC' } });
    return Promise.all(regs.map((r) => this.enrich(r)));
  }

  private async enrich(reg: Registration) {
    const group = await this.groups.findOne({ where: { id: reg.groupId } });
    const race = await this.races.findOne({ where: { id: reg.raceId } });
    const rider = await this.users.findOne({ where: { id: reg.riderId } });
    return {
      ...reg,
      group: group ? { id: group.id, name: group.name, code: group.code, startTime: group.startTime } : null,
      race: race ? { id: race.id, name: race.name, raceDate: race.raceDate, status: race.status, location: race.location } : null,
      rider: rider ? { id: rider.id, displayName: rider.displayName, username: rider.username } : null,
    };
  }
}
