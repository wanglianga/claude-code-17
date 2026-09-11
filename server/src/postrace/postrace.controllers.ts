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
import { IsIn, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import {
  Appeal,
  ChipRecord,
  MedicalRecord,
  Notification,
  PointType,
  Race,
  RaceEvent,
  RaceGroup,
  RaceResult,
  RaceRoute,
  Registration,
  Role,
  RoutePoint,
  ShorteningTask,
  StageShortening,
  SupplyRecord,
  TimelineType,
  User,
  WeatherAlert,
  Withdrawal,
} from '../entities';
import { CurrentUser, Roles } from '../auth/guards';
import { TimelineService } from '../timeline/timeline.module';

// ---------------- 申诉 ----------------

class AppealDto {
  @IsString() @IsNotEmpty() raceId: string;
  @IsString() @IsNotEmpty() registrationId: string;
  @IsIn(['RESULT', 'PENALTY', 'SAFETY', 'OTHER']) @IsOptional() category?: string;
  @IsString() @IsNotEmpty() reason: string;
  @IsString() @IsOptional() evidence?: string;
}

class ResolveAppealDto {
  @IsIn(['UNDER_REVIEW', 'UPHELD', 'REJECTED']) status: string;
  @IsString() @IsOptional() resolution?: string;
}

@Controller('appeals')
export class AppealsController {
  constructor(
    @InjectRepository(Appeal) private appeals: Repository<Appeal>,
    @InjectRepository(Registration) private registrations: Repository<Registration>,
    @InjectRepository(Race) private races: Repository<Race>,
    @InjectRepository(RaceGroup) private groups: Repository<RaceGroup>,
    private timeline: TimelineService,
  ) {}

  /** 选手提交申诉（含证据） */
  @Roles(Role.RIDER)
  @Post()
  async create(@Body() dto: AppealDto, @CurrentUser() user: any) {
    const reg = await this.registrations.findOne({ where: { id: dto.registrationId } });
    if (!reg || reg.riderId !== user.id) throw new NotFoundException('报名记录不存在');
    const race = await this.races.findOne({ where: { id: dto.raceId } });
    if (!race) throw new NotFoundException('赛事不存在');
    const appeal = await this.appeals.save(
      this.appeals.create({
        raceId: race.id,
        registrationId: reg.id,
        category: dto.category || 'RESULT',
        reason: dto.reason,
        evidence: dto.evidence || '',
      }),
    );
    await this.timeline.add(
      race.id,
      TimelineType.APPEAL,
      `申诉提交：号码 ${reg.bibNumber} 就「${appeal.category}」提出申诉：${dto.reason}`,
      { actorId: user.id, actorName: user.displayName, groupIds: [reg.groupId], refType: 'appeal', refId: appeal.id },
    );
    return appeal;
  }

  /** 申诉列表：裁判/运营看全部，选手看自己的 */
  @Get('race/:raceId')
  async list(@Param('raceId') raceId: string, @CurrentUser() user: any) {
    let list = await this.appeals.find({ where: { raceId }, order: { createdAt: 'DESC' } });
    if (user.role === Role.RIDER) {
      const myRegs = await this.registrations.find({ where: { riderId: user.id } });
      const myIds = myRegs.map((r) => r.id);
      list = list.filter((a) => myIds.includes(a.registrationId));
    }
    const result = [];
    for (const a of list) {
      const reg = await this.registrations.findOne({ where: { id: a.registrationId } });
      const group = reg ? await this.groups.findOne({ where: { id: reg.groupId } }) : null;
      result.push({ ...a, bibNumber: reg?.bibNumber, groupName: group?.name });
    }
    return result;
  }

  /** 裁判/运营处理申诉 */
  @Roles(Role.REFEREE, Role.OPS)
  @Post(':id/resolve')
  async resolve(@Param('id') id: string, @Body() dto: ResolveAppealDto, @CurrentUser() user: any) {
    const appeal = await this.appeals.findOne({ where: { id } });
    if (!appeal) throw new NotFoundException('申诉不存在');
    appeal.status = dto.status;
    appeal.resolution = dto.resolution || '';
    appeal.handledById = user.id;
    if (['UPHELD', 'REJECTED'].includes(dto.status)) appeal.resolvedAt = new Date();
    await this.appeals.save(appeal);
    const reg = await this.registrations.findOne({ where: { id: appeal.registrationId } });
    await this.timeline.add(
      appeal.raceId,
      TimelineType.APPEAL,
      `申诉处理：号码 ${reg?.bibNumber || ''} 的申诉 → ${dto.status}${dto.resolution ? `（${dto.resolution}）` : ''}`,
      {
        actorId: user.id,
        actorName: user.displayName,
        groupIds: reg ? [reg.groupId] : [],
        refType: 'appeal',
        refId: appeal.id,
      },
    );
    return appeal;
  }
}

// ---------------- 时间轴 ----------------

@Controller('timeline')
export class TimelineController {
  constructor(private timeline: TimelineService) {}

  /** 统一时间轴：裁判指令/医疗处置/选手通知/事件等；可按组别过滤还原影响面 */
  @Get('race/:raceId')
  list(@Param('raceId') raceId: string, @Query('groupId') groupId?: string) {
    return this.timeline.list(raceId, groupId);
  }
}

// ---------------- 赛事档案 ----------------

@Controller('archive')
export class ArchiveController {
  constructor(
    @InjectRepository(Race) private races: Repository<Race>,
    @InjectRepository(RaceGroup) private groups: Repository<RaceGroup>,
    @InjectRepository(Registration) private registrations: Repository<Registration>,
    @InjectRepository(RaceResult) private results: Repository<RaceResult>,
    @InjectRepository(ChipRecord) private chips: Repository<ChipRecord>,
    @InjectRepository(SupplyRecord) private supplyRecords: Repository<SupplyRecord>,
    @InjectRepository(MedicalRecord) private medicalRecords: Repository<MedicalRecord>,
    @InjectRepository(Appeal) private appeals: Repository<Appeal>,
    @InjectRepository(Withdrawal) private withdrawals: Repository<Withdrawal>,
    @InjectRepository(RaceEvent) private events: Repository<RaceEvent>,
    @InjectRepository(WeatherAlert) private alerts: Repository<WeatherAlert>,
    @InjectRepository(StageShortening) private shortenings: Repository<StageShortening>,
    @InjectRepository(ShorteningTask) private shorteningTasks: Repository<ShorteningTask>,
    @InjectRepository(RaceRoute) private routes: Repository<RaceRoute>,
    @InjectRepository(RoutePoint) private points: Repository<RoutePoint>,
    @InjectRepository(User) private users: Repository<User>,
    private timeline: TimelineService,
  ) {}

  /**
   * 赛事档案：成绩、芯片记录、补给异常、医疗处置、申诉证据汇聚到同一条档案，
   * 用于颁奖、保险理赔与下一届路线优化。
   */
  @Get('race/:raceId')
  async archive(@Param('raceId') raceId: string) {
    const race = await this.races.findOne({ where: { id: raceId } });
    if (!race) throw new NotFoundException('赛事不存在');
    const groups = await this.groups.find({ where: { raceId }, order: { sortOrder: 'ASC' } });
    const registrations = await this.registrations.find({ where: { raceId } });
    const results = await this.results.find({ where: { raceId } });
    const chips = await this.chips.find({ where: { raceId }, order: { readAt: 'ASC' } });
    const supplyRecords = await this.supplyRecords.find({ where: { raceId } });
    const medical = await this.medicalRecords.find({ where: { raceId } });
    const appeals = await this.appeals.find({ where: { raceId } });
    const withdrawals = await this.withdrawals.find({ where: { raceId } });
    const events = await this.events.find({ where: { raceId } });
    const timeline = await this.timeline.list(raceId);

    const routes = await this.routes.find({ where: { raceId } });
    const routeIds = routes.map((r) => r.id);
    const points = routeIds.length ? await this.points.find({ where: { routeId: In(routeIds) } }) : [];
    const pointName = (id: string) => points.find((p) => p.id === id)?.name || '';
    const groupName = (id: string) => groups.find((g) => g.id === id)?.name || '';

    // 成绩 + 每位选手芯片记录
    const resultRows = [];
    for (const r of results) {
      const reg = registrations.find((x) => x.id === r.registrationId);
      const rider = reg ? await this.users.findOne({ where: { id: reg.riderId } }) : null;
      const riderChips = chips
        .filter((c) => c.registrationId === r.registrationId)
        .map((c) => ({ point: pointName(c.routePointId), readAt: c.readAt, source: c.source }));
      resultRows.push({
        bibNumber: reg?.bibNumber || '',
        riderName: rider?.displayName || '',
        group: groupName(r.groupId),
        status: r.status,
        resultRule: r.resultRule,
        netSeconds: r.netSeconds,
        junctionPassedAt: r.junctionPassedAt,
        chips: riderChips,
      });
    }
    resultRows.sort((a, b) => (a.netSeconds ?? 9e9) - (b.netSeconds ?? 9e9));

    // 补给汇总与异常（库存归零或发放超库存的记录）
    const supplyByPoint = points
      .filter((p) => [PointType.SUPPLY, PointType.REPAIR].includes(p.type))
      .map((p) => {
        const recs = supplyRecords.filter((r) => r.routePointId === p.id);
        return {
          point: p.name,
          kmMark: p.kmMark,
          waterGiven: recs.reduce((s, r) => s + r.water, 0),
          gelsGiven: recs.reduce((s, r) => s + r.gels, 0),
          partsGiven: recs.reduce((s, r) => s + r.repairParts, 0),
          ridersPassed: recs.filter((r) => r.registrationId).length,
          waterStockLeft: p.waterStock,
          gelStockLeft: p.gelStock,
          partsStockLeft: p.partsStock,
          anomaly: p.waterStock === 0 || p.gelStock === 0 || p.partsStock === 0,
        };
      });

    const appealsWithEvidence = [];
    for (const a of appeals) {
      const reg = registrations.find((x) => x.id === a.registrationId);
      appealsWithEvidence.push({ ...a, bibNumber: reg?.bibNumber || '' });
    }

    // 天气预警与赛段缩短决策链（预警 → 评估 → 裁判确认 → 任务/签收 → 两类成绩规则）
    const alerts = await this.alerts.find({ where: { raceId }, order: { createdAt: 'ASC' } });
    const shorteningRows = await this.shortenings.find({ where: { raceId }, order: { createdAt: 'ASC' } });
    const shorteningTasks = await this.shorteningTasks.find({ where: { raceId }, order: { createdAt: 'ASC' } });
    const shortenings = [];
    for (const s of shorteningRows) {
      const alert = alerts.find((a) => a.id === s.alertId);
      const j = points.find((p) => p.id === s.newFinishPointId);
      shortenings.push({
        id: s.id,
        status: s.status,
        alert: alert ? { kind: alert.kind, title: alert.title, issuedAt: alert.issuedAt, effectiveUntil: alert.effectiveUntil } : null,
        junction: j ? { name: j.name, kmMark: j.kmMark } : null,
        cutoffPlan: JSON.parse(s.cutoffPlanJson),
        assessmentSummary: s.assessmentSummary,
        proposedAt: s.proposedAt,
        confirmedAt: s.confirmedAt,
        notifiedPostCount: s.notifiedPostIds?.length || 0,
        acknowledgedPostCount: s.acknowledgedPostIds?.length || 0,
        unnotifiedTasks: shorteningTasks.filter((t) => t.shorteningId === s.id && t.unnotified).length,
        tasks: shorteningTasks
          .filter((t) => t.shorteningId === s.id)
          .map((t) => ({ kind: t.kind, title: t.title, status: t.status, unnotified: t.unnotified, detail: t.detail })),
      });
    }

    return {
      race,
      groups,
      stats: {
        registrations: registrations.length,
        approved: registrations.filter((r) => r.status === 'APPROVED').length,
        finished: results.filter((r) => r.status === 'FINISHED').length,
        dnf: results.filter((r) => r.status === 'DNF').length,
        withdrawals: withdrawals.length,
        medicalCases: medical.length,
        appeals: appeals.length,
        events: events.length,
      },
      results: resultRows,
      supply: supplyByPoint,
      medical,
      withdrawals,
      events,
      appeals: appealsWithEvidence,
      shortenings,
      timeline,
    };
  }
}
