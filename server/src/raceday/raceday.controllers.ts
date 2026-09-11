import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  NotFoundException,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { IsArray, IsBoolean, IsIn, IsInt, IsNotEmpty, IsOptional, IsString, Min } from 'class-validator';
import { Type } from 'class-transformer';
import {
  CheckIn,
  ChipRecord,
  EventType,
  MedicalRecord,
  Notification,
  PointType,
  Race,
  RaceEvent,
  RaceGroup,
  RaceResult,
  RaceStatus,
  RaceRoute,
  Registration,
  RegStatus,
  RiderProfile,
  Role,
  RoutePoint,
  SupplyRecord,
  TimelineType,
  User,
  Withdrawal,
} from '../entities';
import { CurrentUser, Roles } from '../auth/guards';
import { TimelineService } from '../timeline/timeline.module';
import { ShorteningService } from '../shortening/shortening.service';
// ---------------- 检录 ----------------

class CheckInDto {
  @IsString() @IsNotEmpty() registrationId: string;
  @IsBoolean() idVerified: boolean;
  @IsBoolean() helmetOk: boolean;
  @IsBoolean() numberPlateOk: boolean;
  @IsBoolean() chipOk: boolean;
  @IsBoolean() brakesOk: boolean;
  @IsBoolean() insuranceOk: boolean;
  @IsString() @IsOptional() notes?: string;
}

@Controller('checkins')
export class CheckInsController {
  constructor(
    @InjectRepository(CheckIn) private checkIns: Repository<CheckIn>,
    @InjectRepository(Registration) private registrations: Repository<Registration>,
    @InjectRepository(Race) private races: Repository<Race>,
    @InjectRepository(RaceGroup) private groups: Repository<RaceGroup>,
    @InjectRepository(User) private users: Repository<User>,
    private timeline: TimelineService,
  ) {}

  /** 检录：核验证件/头盔/号码牌/芯片/刹车/保险，全部通过才算合格 */
  @Roles(Role.CHECKIN, Role.OPS)
  @Post()
  async checkIn(@Body() dto: CheckInDto, @CurrentUser() user: any) {
    const reg = await this.registrations.findOne({ where: { id: dto.registrationId } });
    if (!reg) throw new NotFoundException('报名记录不存在');
    if (reg.status !== RegStatus.APPROVED) throw new BadRequestException('只有审核通过的报名才能检录');
    const race = await this.races.findOne({ where: { id: reg.raceId } });
    if (race.status !== RaceStatus.RACE_DAY) throw new BadRequestException('只有比赛日当天才能检录');

    const allOk =
      dto.idVerified && dto.helmetOk && dto.numberPlateOk && dto.chipOk && dto.brakesOk && dto.insuranceOk;
    let record = await this.checkIns.findOne({ where: { registrationId: reg.id } });
    if (!record) record = this.checkIns.create({ registrationId: reg.id, checkedById: user.id });
    Object.assign(record, {
      checkedById: user.id,
      idVerified: dto.idVerified,
      helmetOk: dto.helmetOk,
      numberPlateOk: dto.numberPlateOk,
      chipOk: dto.chipOk,
      brakesOk: dto.brakesOk,
      insuranceOk: dto.insuranceOk,
      status: allOk ? 'PASSED' : 'FAILED',
      notes: dto.notes || '',
    });
    record = await this.checkIns.save(record);
    const group = await this.groups.findOne({ where: { id: reg.groupId } });
    await this.timeline.add(
      reg.raceId,
      TimelineType.CHECKIN,
      `检录${allOk ? '通过' : '未通过'}：号码 ${reg.bibNumber}（${group?.name || ''}）${dto.notes ? ` 备注：${dto.notes}` : ''}`,
      { actorId: user.id, actorName: user.displayName, groupIds: [reg.groupId], refType: 'checkin', refId: record.id },
    );
    return record;
  }

  /** 检录工作台：某赛事的报名 + 检录状态列表 */
  @Roles(Role.CHECKIN, Role.OPS, Role.REFEREE)
  @Get('race/:raceId')
  async listForRace(@Param('raceId') raceId: string) {
    const regs = await this.registrations.find({ where: { raceId, status: RegStatus.APPROVED } });
    const result = [];
    for (const reg of regs) {
      const group = await this.groups.findOne({ where: { id: reg.groupId } });
      const rider = await this.users.findOne({ where: { id: reg.riderId } });
      const profile = await this.registrations.manager.getRepository(RiderProfile).findOne({ where: { userId: reg.riderId } });
      const checkIn = await this.checkIns.findOne({ where: { registrationId: reg.id } });
      result.push({
        ...reg,
        group: group ? { id: group.id, name: group.name, code: group.code, sortOrder: group.sortOrder, startTime: group.startTime } : null,
        rider: rider ? { id: rider.id, displayName: rider.displayName } : null,
        profile: profile
          ? { fullName: profile.fullName, idType: profile.idType, idNumber: profile.idNumber, insuranceProvider: profile.insuranceProvider, insuranceValidUntil: profile.insuranceValidUntil, vehicleType: profile.vehicleType }
          : null,
        checkIn: checkIn || null,
      });
    }
    result.sort((a, b) => (a.group?.sortOrder ?? 0) - (b.group?.sortOrder ?? 0) || a.bibNumber.localeCompare(b.bibNumber));
    return result;
  }

  /** 发车队列：仅检录通过的选手可进入 */
  @Get('race/:raceId/queue')
  async startQueue(@Param('raceId') raceId: string) {
    const all = await this.listForRace(raceId);
    return all.filter((r) => r.checkIn?.status === 'PASSED');
  }
}

// ---------------- 补给点 ----------------

class SupplyRecordDto {
  @IsString() @IsNotEmpty() routePointId: string;
  @IsString() @IsOptional() registrationId?: string;
  @Type(() => Number) @IsInt() @Min(0) @IsOptional() water?: number;
  @Type(() => Number) @IsInt() @Min(0) @IsOptional() gels?: number;
  @Type(() => Number) @IsInt() @Min(0) @IsOptional() repairParts?: number;
  @IsString() @IsOptional() note?: string;
}

@Controller('supplies')
export class SuppliesController {
  constructor(
    @InjectRepository(SupplyRecord) private records: Repository<SupplyRecord>,
    @InjectRepository(RoutePoint) private points: Repository<RoutePoint>,
    @InjectRepository(RaceRoute) private routes: Repository<RaceRoute>,
    @InjectRepository(Race) private races: Repository<Race>,
    @InjectRepository(Registration) private registrations: Repository<Registration>,
    @InjectRepository(RaceGroup) private groups: Repository<RaceGroup>,
    @InjectRepository(Notification) private notifications: Repository<Notification>,
    private timeline: TimelineService,
  ) {}

  /** 补给点记录：饮水/能量胶/维修配件 + 选手通过 */
  @Roles(Role.SUPPLY, Role.OPS)
  @Post('records')
  async record(@Body() dto: SupplyRecordDto, @CurrentUser() user: any) {
    const point = await this.points.findOne({ where: { id: dto.routePointId } });
    if (!point) throw new NotFoundException('点位不存在');
    if (![PointType.SUPPLY, PointType.REPAIR].includes(point.type)) {
      throw new BadRequestException('只有补给点/维修点可以登记补给记录');
    }
    const route = await this.routes.findOne({ where: { id: point.routeId } });
    const race = await this.races.findOne({ where: { id: route.raceId } });
    if (race.status !== RaceStatus.RACE_DAY) throw new BadRequestException('只有比赛日才能登记补给记录');

    let reg: Registration = null;
    if (dto.registrationId) {
      reg = await this.registrations.findOne({ where: { id: dto.registrationId, raceId: race.id } });
      if (!reg) throw new NotFoundException('选手报名记录不存在');
    }

    const water = dto.water ?? 0;
    const gels = dto.gels ?? 0;
    const parts = dto.repairParts ?? 0;

    // 扣减库存，库存不足 → 补给异常（进入时间轴并通知补给/裁判）
    const shortages: string[] = [];
    if (water > 0) {
      if (point.waterStock < water) shortages.push(`饮水库存不足（需 ${water}，余 ${point.waterStock}）`);
      point.waterStock = Math.max(0, point.waterStock - water);
    }
    if (gels > 0) {
      if (point.gelStock < gels) shortages.push(`能量胶库存不足（需 ${gels}，余 ${point.gelStock}）`);
      point.gelStock = Math.max(0, point.gelStock - gels);
    }
    if (parts > 0) {
      if (point.partsStock < parts) shortages.push(`维修配件库存不足（需 ${parts}，余 ${point.partsStock}）`);
      point.partsStock = Math.max(0, point.partsStock - parts);
    }
    await this.points.save(point);

    const record = await this.records.save(
      this.records.create({
        raceId: race.id,
        routePointId: point.id,
        registrationId: reg?.id || null,
        water,
        gels,
        repairParts: parts,
        note: dto.note || '',
        recordedById: user.id,
      }),
    );

    if (shortages.length) {
      const msg = `补给异常 @${point.name}：${shortages.join('；')}`;
      await this.timeline.add(race.id, TimelineType.SUPPLY_ANOMALY, msg, {
        actorId: user.id,
        actorName: user.displayName,
        refType: 'supply_record',
        refId: record.id,
      });
      for (const role of [Role.SUPPLY, Role.REFEREE]) {
        await this.notifications.save(
          this.notifications.create({ raceId: race.id, targetRole: role, title: '补给异常', message: msg }),
        );
      }
    }
    return { record, point };
  }

  /** 某赛事补给总览（库存、发放量、异常） */
  @Get('race/:raceId/summary')
  async summary(@Param('raceId') raceId: string) {
    const routes = await this.routes.find({ where: { raceId } });
    const routeIds = routes.map((r) => r.id);
    const points = routeIds.length
      ? await this.points.find({ where: { routeId: In(routeIds), type: In([PointType.SUPPLY, PointType.REPAIR]) } })
      : [];
    const records = await this.records.find({ where: { raceId }, order: { passedAt: 'DESC' } });
    const byPoint = points.map((p) => {
      const recs = records.filter((r) => r.routePointId === p.id);
      return {
        point: p,
        recordCount: recs.length,
        waterGiven: recs.reduce((s, r) => s + r.water, 0),
        gelsGiven: recs.reduce((s, r) => s + r.gels, 0),
        partsGiven: recs.reduce((s, r) => s + r.repairParts, 0),
        ridersPassed: recs.filter((r) => r.registrationId).length,
      };
    });
    return { points: byPoint, records: records.slice(0, 100) };
  }
}

// ---------------- 赛道事件与通知 ----------------

/** 五类赛道事件均通知：裁判 / 医疗 / 补给 / 志愿者 */
const ALL_POSTS: Role[] = [Role.REFEREE, Role.MEDICAL, Role.SUPPLY, Role.VOLUNTEER];

const EVENT_TARGETS: Record<string, Role[]> = {
  [EventType.GROUP_STUCK]: ALL_POSTS,
  [EventType.WEATHER]: ALL_POSTS,
  [EventType.CRASH]: ALL_POSTS,
  [EventType.CHIP_MISREAD]: ALL_POSTS,
  [EventType.TRAFFIC_LIFTED]: ALL_POSTS,
  [EventType.OTHER]: [Role.REFEREE],
};

class EventDto {
  @IsIn(Object.values(EventType)) type: EventType;
  @IsString() @IsNotEmpty() raceId: string;
  @IsString() @IsNotEmpty() title: string;
  @IsString() @IsOptional() description?: string;
  @IsIn(['INFO', 'WARNING', 'CRITICAL']) @IsOptional() severity?: string;
  @IsString() @IsOptional() groupId?: string;
  @IsString() @IsOptional() routePointId?: string;
  @IsArray() @IsOptional() targetRoles?: Role[];
}

@Controller('events')
export class EventsController {
  constructor(
    @InjectRepository(RaceEvent) private events: Repository<RaceEvent>,
    @InjectRepository(Notification) private notifications: Repository<Notification>,
    @InjectRepository(Race) private races: Repository<Race>,
    @InjectRepository(RaceGroup) private groups: Repository<RaceGroup>,
    private timeline: TimelineService,
  ) {}

  /** 上报赛道事件：自动把信息推送给裁判/医疗/补给/志愿者 */
  @Roles(Role.OPS, Role.REFEREE, Role.SUPPLY, Role.MEDICAL, Role.VOLUNTEER, Role.CHECKIN)
  @Post()
  async create(@Body() dto: EventDto, @CurrentUser() user: any) {
    const race = await this.races.findOne({ where: { id: dto.raceId } });
    if (!race) throw new NotFoundException('赛事不存在');
    const event = await this.events.save(
      this.events.create({
        raceId: race.id,
        type: dto.type,
        severity: dto.severity || 'WARNING',
        title: dto.title,
        description: dto.description || '',
        groupId: dto.groupId || null,
        routePointId: dto.routePointId || null,
        createdById: user.id,
      }),
    );
    const targets = dto.targetRoles?.length ? dto.targetRoles : EVENT_TARGETS[dto.type] || [Role.REFEREE];
    const group = dto.groupId ? await this.groups.findOne({ where: { id: dto.groupId } }) : null;
    for (const role of targets) {
      await this.notifications.save(
        this.notifications.create({
          raceId: race.id,
          eventId: event.id,
          targetRole: role,
          targetGroupId: dto.groupId || null,
          title: `[${dto.type}] ${dto.title}`,
          message: dto.description || '',
        }),
      );
    }
    await this.timeline.add(
      race.id,
      TimelineType.EVENT,
      `赛道事件[${dto.type}] ${dto.title}${group ? `（影响组别：${group.name}）` : ''} → 已通知 ${targets.join('/')}`,
      {
        actorId: user.id,
        actorName: user.displayName,
        groupIds: dto.groupId ? [dto.groupId] : [],
        refType: 'event',
        refId: event.id,
      },
    );
    return { ...event, notifiedRoles: targets };
  }

  @Get('race/:raceId')
  async list(@Param('raceId') raceId: string) {
    const events = await this.events.find({ where: { raceId }, order: { createdAt: 'DESC' } });
    const groups = await this.groups.find({ where: { raceId } });
    return events.map((e) => ({
      ...e,
      group: e.groupId ? groups.find((g) => g.id === e.groupId) || null : null,
    }));
  }

  @Roles(Role.OPS, Role.REFEREE, Role.MEDICAL, Role.SUPPLY, Role.VOLUNTEER)
  @Post(':id/status')
  async setStatus(@Param('id') id: string, @Body('status') status: string, @CurrentUser() user: any) {
    if (!['OPEN', 'ACKNOWLEDGED', 'RESOLVED'].includes(status)) throw new BadRequestException('非法状态');
    const event = await this.events.findOne({ where: { id } });
    if (!event) throw new NotFoundException('事件不存在');
    event.status = status;
    if (status === 'RESOLVED') event.resolvedAt = new Date();
    await this.events.save(event);
    await this.timeline.add(event.raceId, TimelineType.EVENT, `事件「${event.title}」状态 → ${status}`, {
      actorId: user.id,
      actorName: user.displayName,
      groupIds: event.groupId ? [event.groupId] : [],
      refType: 'event',
      refId: event.id,
    });
    return event;
  }

  /** 我的角色待办通知 */
  @Get('notifications/mine')
  async myNotifications(@CurrentUser() user: any, @Query('raceId') raceId?: string) {
    const where: any = { targetRole: user.role };
    if (raceId) where.raceId = raceId;
    const list = await this.notifications.find({ where, order: { id: 'DESC' }, take: 50 });
    return list;
  }

  /** 选手通知（按我所在组别过滤） */
  @Roles(Role.RIDER)
  @Get('notifications/rider')
  async riderNotifications(@CurrentUser() user: any) {
    const regs = await this.registrationsOf(user.id);
    const groupIds = regs.map((r) => r.groupId);
    const raceIds = regs.map((r) => r.raceId);
    if (!raceIds.length) return [];
    const all = await this.notifications.find({
      where: { targetRole: Role.RIDER, raceId: In(raceIds) },
      order: { id: 'DESC' },
      take: 50,
    });
    return all.filter((n) => !n.targetGroupId || groupIds.includes(n.targetGroupId));
  }

  private registrationsOf(riderId: string) {
    return this.notifications.manager.getRepository(Registration).find({ where: { riderId } });
  }
}

// ---------------- 裁判指令 / 选手通知 ----------------

class InstructionDto {
  @IsString() @IsNotEmpty() raceId: string;
  @IsString() @IsNotEmpty() message: string;
  @IsArray() @IsOptional() groupIds?: string[]; // 空=全部组别
}

@Controller('instructions')
export class InstructionsController {
  constructor(
    @InjectRepository(Notification) private notifications: Repository<Notification>,
    @InjectRepository(RaceGroup) private groups: Repository<RaceGroup>,
    private timeline: TimelineService,
  ) {}

  /** 裁判发布指令：进入统一时间轴，并作为选手通知推送 */
  @Roles(Role.REFEREE, Role.OPS)
  @Post()
  async issue(@Body() dto: InstructionDto, @CurrentUser() user: any) {
    const groups = await this.groups.find({ where: { raceId: dto.raceId } });
    const targetIds = dto.groupIds?.length ? dto.groupIds : groups.map((g) => g.id);
    const names = groups.filter((g) => targetIds.includes(g.id)).map((g) => g.name);
    for (const gid of targetIds) {
      await this.notifications.save(
        this.notifications.create({
          raceId: dto.raceId,
          targetRole: Role.RIDER,
          targetGroupId: gid,
          title: '裁判指令',
          message: dto.message,
        }),
      );
    }
    await this.timeline.add(
      dto.raceId,
      TimelineType.REFEREE_INSTRUCTION,
      `裁判指令：${dto.message}（影响组别：${names.join('、') || '全部'}）`,
      { actorId: user.id, actorName: user.displayName, groupIds: targetIds },
    );
    return { ok: true, groups: names };
  }
}

// ---------------- 退赛 ----------------

class WithdrawalDto {
  @IsString() @IsNotEmpty() registrationId: string;
  @IsString() @IsOptional() routePointId?: string;
  @Type(() => Number) @IsOptional() kmMark?: number;
  @IsString() @IsNotEmpty() reason: string;
  @IsBoolean() @IsOptional() needsShuttle?: boolean;
  @IsIn(['OK', 'DAMAGED', 'LEFT_ON_SITE']) @IsOptional() vehicleStatus?: string;
}

@Controller('withdrawals')
export class WithdrawalsController {
  constructor(
    @InjectRepository(Withdrawal) private withdrawals: Repository<Withdrawal>,
    @InjectRepository(Registration) private registrations: Repository<Registration>,
    @InjectRepository(RaceResult) private results: Repository<RaceResult>,
    @InjectRepository(Notification) private notifications: Repository<Notification>,
    @InjectRepository(RaceGroup) private groups: Repository<RaceGroup>,
    @InjectRepository(RoutePoint) private points: Repository<RoutePoint>,
    private timeline: TimelineService,
  ) {}

  /** 登记退赛：位置/原因/是否接驳/车辆状态 */
  @Roles(Role.RIDER, Role.OPS, Role.REFEREE, Role.VOLUNTEER, Role.MEDICAL)
  @Post()
  async create(@Body() dto: WithdrawalDto, @CurrentUser() user: any) {
    const reg = await this.registrations.findOne({ where: { id: dto.registrationId } });
    if (!reg) throw new NotFoundException('报名记录不存在');
    if (user.role === Role.RIDER && reg.riderId !== user.id) throw new ForbiddenException('只能登记自己的退赛');
    const dup = await this.withdrawals.findOne({ where: { registrationId: reg.id } });
    if (dup) throw new BadRequestException('该选手已登记退赛');
    const point = dto.routePointId ? await this.points.findOne({ where: { id: dto.routePointId } }) : null;
    const withdrawal = await this.withdrawals.save(
      this.withdrawals.create({
        raceId: reg.raceId,
        registrationId: reg.id,
        routePointId: dto.routePointId || null,
        kmMark: dto.kmMark ?? point?.kmMark ?? null,
        reason: dto.reason,
        needsShuttle: dto.needsShuttle ?? false,
        vehicleStatus: dto.vehicleStatus || 'OK',
        reportedById: user.id,
      }),
    );
    // 成绩标记 DNF
    const existing = await this.results.findOne({ where: { registrationId: reg.id } });
    if (!existing) {
      await this.results.save(
        this.results.create({ registrationId: reg.id, raceId: reg.raceId, groupId: reg.groupId, status: 'DNF' }),
      );
    }
    const group = await this.groups.findOne({ where: { id: reg.groupId } });
    const where = point ? point.name : dto.kmMark != null ? `${dto.kmMark}km 处` : '赛道途中';
    await this.timeline.add(
      reg.raceId,
      TimelineType.WITHDRAWAL,
      `退赛登记：号码 ${reg.bibNumber}（${group?.name || ''}）于${where}退赛，原因：${dto.reason}；接驳：${dto.needsShuttle ? '需要' : '不需要'}；车辆：${dto.vehicleStatus || 'OK'}`,
      { actorId: user.id, actorName: user.displayName, groupIds: [reg.groupId], refType: 'withdrawal', refId: withdrawal.id },
    );
    if (dto.needsShuttle) {
      await this.notifications.save(
        this.notifications.create({
          raceId: reg.raceId,
          targetRole: Role.VOLUNTEER,
          targetGroupId: reg.groupId,
          title: '退赛接驳请求',
          message: `号码 ${reg.bibNumber} 在${where}退赛，需要接驳。原因：${dto.reason}`,
        }),
      );
    }
    return withdrawal;
  }

  @Get('race/:raceId')
  async list(@Param('raceId') raceId: string) {
    const list = await this.withdrawals.find({ where: { raceId }, order: { reportedAt: 'DESC' } });
    const result = [];
    for (const w of list) {
      const reg = await this.registrations.findOne({ where: { id: w.registrationId } });
      const group = reg ? await this.groups.findOne({ where: { id: reg.groupId } }) : null;
      const point = w.routePointId ? await this.points.findOne({ where: { id: w.routePointId } }) : null;
      result.push({ ...w, bibNumber: reg?.bibNumber, group: group?.name, pointName: point?.name });
    }
    return result;
  }
}

// ---------------- 计时与成绩 ----------------

class ChipDto {
  @IsString() @IsNotEmpty() registrationId: string;
  @IsString() @IsNotEmpty() routePointId: string;
  @IsString() @IsOptional() readAt?: string; // ISO，缺省=当前时间
}

@Controller('results')
export class ResultsController {
  constructor(
    @InjectRepository(ChipRecord) private chips: Repository<ChipRecord>,
    @InjectRepository(RaceResult) private results: Repository<RaceResult>,
    @InjectRepository(Registration) private registrations: Repository<Registration>,
    @InjectRepository(RoutePoint) private points: Repository<RoutePoint>,
    @InjectRepository(RaceRoute) private routes: Repository<RaceRoute>,
    @InjectRepository(Race) private races: Repository<Race>,
    @InjectRepository(RaceGroup) private groups: Repository<RaceGroup>,
    @InjectRepository(CheckIn) private checkIns: Repository<CheckIn>,
    @InjectRepository(User) private users: Repository<User>,
    private timeline: TimelineService,
    private shortening: ShorteningService,
  ) {}

  /** 录入芯片记录；原终点自动计净成绩；赛段缩短后在新终点过点 → 关门核验（关门前=关门点成绩，超时=DNF） */
  @Roles(Role.REFEREE, Role.OPS)
  @Post('chips')
  async recordChip(@Body() dto: ChipDto, @CurrentUser() user: any) {
    const reg = await this.registrations.findOne({ where: { id: dto.registrationId } });
    if (!reg) throw new NotFoundException('报名记录不存在');
    const point = await this.points.findOne({ where: { id: dto.routePointId } });
    if (!point) throw new NotFoundException('点位不存在');
    const chip = await this.chips.save(
      this.chips.create({
        raceId: reg.raceId,
        registrationId: reg.id,
        routePointId: point.id,
        readAt: dto.readAt ? new Date(dto.readAt) : new Date(),
        source: 'MANUAL',
        createdById: user.id,
      }),
    );
    // 赛段缩短已确认：该点位为新终点时走关门核验（只处理"未通过关键路口"的选手）
    const confirmed = await this.shortening.confirmedForRace(reg.raceId);
    if (confirmed && confirmed.newFinishPointId === point.id) {
      const existing = await this.results.findOne({ where: { registrationId: reg.id } });
      if (existing?.resultRule === 'BEHIND_CUTOFF') {
        const verdict = await this.shortening.verifyCutoff(confirmed.id, user, {
          regId: reg.id,
          readAt: chip.readAt,
        });
        const result = await this.results.findOne({ where: { registrationId: reg.id } });
        return { chip, result, cutoffVerdict: verdict };
      }
    }
    let result = null;
    if (point.type === PointType.FINISH && point.isActive) {
      result = await this.computeResult(reg, user);
    }
    return { chip, result };
  }

  private async computeResult(reg: Registration, user: any) {
    const race = await this.races.findOne({ where: { id: reg.raceId } });
    const group = await this.groups.findOne({ where: { id: reg.groupId } });
    const routes = await this.routes.find({ where: { raceId: reg.raceId } });
    const routeIds = routes.map((r) => r.id);
    const startPoint = routeIds.length
      ? await this.points.findOne({ where: { routeId: In(routeIds), type: PointType.START } })
      : null;
    const finishPoint = routeIds.length
      ? await this.points.findOne({ where: { routeId: In(routeIds), type: PointType.FINISH } })
      : null;
    const chips = await this.chips.find({ where: { registrationId: reg.id }, order: { readAt: 'ASC' } });
    const startChip = startPoint ? chips.find((c) => c.routePointId === startPoint.id) : null;
    const finishChips = finishPoint ? chips.filter((c) => c.routePointId === finishPoint.id) : [];
    const startedAt = startChip?.readAt || (group?.startTime ? new Date(`${race.raceDate}T${group.startTime}:00`) : null);
    const finishedAt = finishChips.length ? finishChips[finishChips.length - 1].readAt : chips[chips.length - 1]?.readAt || new Date();
    const netSeconds = startedAt ? Math.max(0, Math.round((finishedAt.getTime() - startedAt.getTime()) / 1000)) : null;
    let result = await this.results.findOne({ where: { registrationId: reg.id } });
    if (!result) {
      result = this.results.create({ registrationId: reg.id, raceId: reg.raceId, groupId: reg.groupId });
    }
    result.status = 'FINISHED';
    result.startedAt = startedAt;
    result.finishedAt = finishedAt;
    result.netSeconds = netSeconds;
    result = await this.results.save(result);
    await this.timeline.add(
      reg.raceId,
      TimelineType.RESULT,
      `成绩产生：号码 ${reg.bibNumber} 净成绩 ${netSeconds != null ? this.fmt(netSeconds) : '未知'}`,
      { actorId: user.id, actorName: user.displayName, groupIds: [reg.groupId], refType: 'result', refId: result.id },
    );
    return result;
  }

  private fmt(sec: number) {
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }

  /** 演示用：为全部检录通过选手生成模拟芯片与成绩 */
  @Roles(Role.OPS, Role.REFEREE)
  @Post('race/:raceId/simulate')
  async simulate(@Param('raceId') raceId: string, @CurrentUser() user: any) {
    const race = await this.races.findOne({ where: { id: raceId } });
    if (!race) throw new NotFoundException('赛事不存在');
    if (race.status !== RaceStatus.RACE_DAY) throw new BadRequestException('只有比赛日才能生成成绩');
    const routes = await this.routes.find({ where: { raceId } });
    const routeIds = routes.map((r) => r.id);
    const points = routeIds.length ? await this.points.find({ where: { routeId: In(routeIds) } }) : [];
    const start = points.find((p) => p.type === PointType.START);
    const finish = points.find((p) => p.type === PointType.FINISH);
    if (!start || !finish) throw new BadRequestException('路线缺少起点或终点');
    const timingPoints = points.filter((p) => p.type === PointType.TIMING).sort((a, b) => a.kmMark - b.kmMark);

    const regs = await this.registrations.find({ where: { raceId, status: RegStatus.APPROVED } });
    let created = 0;
    for (const reg of regs) {
      const ci = await this.checkIns.findOne({ where: { registrationId: reg.id } });
      if (ci?.status !== 'PASSED') continue;
      const done = await this.results.findOne({ where: { registrationId: reg.id } });
      if (done?.status === 'FINISHED') continue;
      // 赛段缩短产生的成绩（关门核验中/已过关键路口/关门点成绩/关门超时）不由模拟流程处理
      if (done && ['PASSED_JUNCTION', 'BEHIND_CUTOFF', 'PASSED_CUTOFF', 'MISSED_CUTOFF'].includes(done.resultRule)) continue;
      const group = await this.groups.findOne({ where: { id: reg.groupId } });
      const startTime = new Date(`${race.raceDate}T${group?.startTime || '08:00'}:00`);
      const jitterSec = Math.floor(Math.random() * 120);
      const durationSec = 5400 + Math.floor(Math.random() * 5400); // 1.5h - 3h
      const startedAt = new Date(startTime.getTime() + jitterSec * 1000);
      const finishedAt = new Date(startedAt.getTime() + durationSec * 1000);
      await this.chips.save(this.chips.create({ raceId, registrationId: reg.id, routePointId: start.id, readAt: startedAt, source: 'AUTO', createdById: user.id }));
      for (const tp of timingPoints) {
        const ratio = tp.kmMark / (finish.kmMark || 1);
        const readAt = new Date(startedAt.getTime() + durationSec * ratio * 1000);
        await this.chips.save(this.chips.create({ raceId, registrationId: reg.id, routePointId: tp.id, readAt, source: 'AUTO', createdById: user.id }));
      }
      await this.chips.save(this.chips.create({ raceId, registrationId: reg.id, routePointId: finish.id, readAt: finishedAt, source: 'AUTO', createdById: user.id }));
      await this.computeResult(reg, user);
      created++;
    }
    return { created };
  }

  /** 成绩榜（按组别排名，用于颁奖）；赛段缩短后已过关键路口与关门点成绩分开排名 */
  @Get('race/:raceId')
  async rankings(@Param('raceId') raceId: string) {
    const results = await this.results.find({ where: { raceId } });
    const groups = await this.groups.find({ where: { raceId }, order: { sortOrder: 'ASC' } });
    const shortening = await this.shortening.confirmedForRace(raceId);
    const junction = shortening
      ? await this.points.findOne({ where: { id: shortening.newFinishPointId } })
      : null;
    const rows = [];
    for (const r of results) {
      const reg = await this.registrations.findOne({ where: { id: r.registrationId } });
      const rider = reg ? await this.users.findOne({ where: { id: reg.riderId } }) : null;
      rows.push({
        ...r,
        bibNumber: reg?.bibNumber || '',
        riderName: rider?.displayName || '',
        groupId: r.groupId,
      });
    }
    const byGroup = groups.map((g) => {
      const inGroup = rows.filter((r) => r.groupId === g.id);
      // 有效成绩：正常完赛、已过关键路口（按过点计时）、关门前到达（关门点成绩）
      const timeable = inGroup.filter(
        (r) => r.status === 'FINISHED' && r.netSeconds != null && ['NORMAL', 'PASSED_JUNCTION', 'PASSED_CUTOFF'].includes(r.resultRule),
      );
      // 已过关键路口与其他有效成绩分别排名（不同记录规则不混排）
      const junctionFinishers = timeable
        .filter((r) => r.resultRule === 'PASSED_JUNCTION')
        .sort((a, b) => (a.junctionPassedAt ? +new Date(a.junctionPassedAt) : 0) - (b.junctionPassedAt ? +new Date(b.junctionPassedAt) : 0))
        .map((r, i) => ({ ...r, rank: i + 1 }));
      const normalFinishers = timeable
        .filter((r) => r.resultRule !== 'PASSED_JUNCTION')
        .sort((a, b) => a.netSeconds - b.netSeconds)
        .map((r, i) => ({ ...r, rank: i + 1 }));
      const finished = [...junctionFinishers, ...normalFinishers].sort((a, b) => a.rank - b.rank);
      // 关门核验中 / 关门超时 DNF / 退赛 DNF 等无有效计时成绩
      const others = inGroup.filter((r) => !(r.status === 'FINISHED' && r.netSeconds != null));
      return { group: g, finished, others };
    });
    return {
      groups: byGroup,
      shortening: shortening
        ? {
            id: shortening.id,
            junction: junction ? { id: junction.id, name: junction.name, kmMark: junction.kmMark } : null,
            cutoffPlan: JSON.parse(shortening.cutoffPlanJson),
            confirmedAt: shortening.confirmedAt,
          }
        : null,
    };
  }

  /** 某选手的芯片记录 */
  @Get('chips/:registrationId')
  async chipsOf(@Param('registrationId') registrationId: string) {
    const chips = await this.chips.find({ where: { registrationId }, order: { readAt: 'ASC' } });
    const result = [];
    for (const c of chips) {
      const point = await this.points.findOne({ where: { id: c.routePointId } });
      result.push({ ...c, point: point ? { name: point.name, type: point.type, kmMark: point.kmMark } : null });
    }
    return result;
  }
}

// ---------------- 医疗处置 ----------------

class MedicalDto {
  @IsString() @IsNotEmpty() raceId: string;
  @IsString() @IsOptional() registrationId?: string;
  @IsString() @IsOptional() routePointId?: string;
  @IsString() @IsNotEmpty() condition: string;
  @IsString() @IsNotEmpty() treatment: string;
  @IsIn(['MINOR', 'MODERATE', 'SEVERE']) @IsOptional() severity?: string;
  @IsString() @IsOptional() outcome?: string;
}

@Controller('medical')
export class MedicalController {
  constructor(
    @InjectRepository(MedicalRecord) private records: Repository<MedicalRecord>,
    @InjectRepository(Registration) private registrations: Repository<Registration>,
    @InjectRepository(RaceGroup) private groups: Repository<RaceGroup>,
    @InjectRepository(RoutePoint) private points: Repository<RoutePoint>,
    private timeline: TimelineService,
  ) {}

  /** 医疗处置登记：进入统一时间轴 */
  @Roles(Role.MEDICAL, Role.OPS)
  @Post()
  async create(@Body() dto: MedicalDto, @CurrentUser() user: any) {
    let groupId: string = null;
    let bib = '';
    if (dto.registrationId) {
      const reg = await this.registrations.findOne({ where: { id: dto.registrationId } });
      if (reg) {
        groupId = reg.groupId;
        bib = reg.bibNumber;
      }
    }
    const record = await this.records.save(
      this.records.create({
        raceId: dto.raceId,
        registrationId: dto.registrationId || null,
        routePointId: dto.routePointId || null,
        groupId,
        condition: dto.condition,
        treatment: dto.treatment,
        severity: dto.severity || 'MINOR',
        outcome: dto.outcome || '',
        handledById: user.id,
      }),
    );
    const point = dto.routePointId ? await this.points.findOne({ where: { id: dto.routePointId } }) : null;
    await this.timeline.add(
      dto.raceId,
      TimelineType.MEDICAL,
      `医疗处置${bib ? `（号码 ${bib}）` : ''}${point ? ` @${point.name}` : ''}：${dto.condition} → ${dto.treatment}`,
      { actorId: user.id, actorName: user.displayName, groupIds: groupId ? [groupId] : [], refType: 'medical', refId: record.id },
    );
    return record;
  }

  @Get('race/:raceId')
  async list(@Param('raceId') raceId: string) {
    const records = await this.records.find({ where: { raceId }, order: { createdAt: 'DESC' } });
    const result = [];
    for (const r of records) {
      const reg = r.registrationId ? await this.registrations.findOne({ where: { id: r.registrationId } }) : null;
      const point = r.routePointId ? await this.points.findOne({ where: { id: r.routePointId } }) : null;
      result.push({ ...r, bibNumber: reg?.bibNumber, pointName: point?.name });
    }
    return result;
  }
}
