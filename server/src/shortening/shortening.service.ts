import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
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
  RaceRoute,
  Registration,
  RegStatus,
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
import { TimelineService } from '../timeline/timeline.module';

export const WEATHER_KINDS: Record<string, { label: string; paceFactor: number }> = {
  WIND: { label: '大风', paceFactor: 0.75 },
  RAIN: { label: '暴雨', paceFactor: 0.8 },
  HEAT: { label: '高温', paceFactor: 0.7 },
};

export const RESULT_RULES: Record<string, string> = {
  NORMAL: '正常终点成绩',
  PASSED_JUNCTION: '已过关键路口·按过点计时',
  BEHIND_CUTOFF: '未过关键路口·关门核验中',
  PASSED_CUTOFF: '关门前到达·关门点成绩',
};

const POST_ROLE_BY_TYPE: Record<string, Role | null> = {
  START: Role.CHECKIN,
  FINISH: Role.CHECKIN,
  TIMING: Role.CHECKIN,
  TRAFFIC_CONTROL: Role.VOLUNTEER,
  SUPPLY: Role.SUPPLY,
  REPAIR: Role.SUPPLY,
  MEDICAL: Role.MEDICAL,
  CLIMB: Role.VOLUNTEER,
};

function hmToMin(hm: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hm || '');
  if (!m) return null;
  return +m[1] * 60 + +m[2];
}
function minToHm(min: number): string {
  const m = Math.max(0, Math.round(min));
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

interface RiderPos {
  reg: Registration;
  bib: string;
  groupId: string;
  point: RoutePoint | null;
  km: number;
  lastReadAt: Date | null;
  junctionChip: ChipRecord | null;
  ahead: boolean;
}

@Injectable()
export class ShorteningService {
  constructor(
    @InjectRepository(WeatherAlert) private alerts: Repository<WeatherAlert>,
    @InjectRepository(StageShortening) private shortenings: Repository<StageShortening>,
    @InjectRepository(ShorteningTask) private tasks: Repository<ShorteningTask>,
    @InjectRepository(Race) private races: Repository<Race>,
    @InjectRepository(RaceGroup) private groups: Repository<RaceGroup>,
    @InjectRepository(RaceRoute) private routes: Repository<RaceRoute>,
    @InjectRepository(RoutePoint) private points: Repository<RoutePoint>,
    @InjectRepository(Registration) private registrations: Repository<Registration>,
    @InjectRepository(CheckIn) private checkIns: Repository<CheckIn>,
    @InjectRepository(ChipRecord) private chips: Repository<ChipRecord>,
    @InjectRepository(SupplyRecord) private supplyRecords: Repository<SupplyRecord>,
    @InjectRepository(MedicalRecord) private medicalRecords: Repository<MedicalRecord>,
    @InjectRepository(RaceResult) private results: Repository<RaceResult>,
    @InjectRepository(Withdrawal) private withdrawals: Repository<Withdrawal>,
    @InjectRepository(Notification) private notifications: Repository<Notification>,
    @InjectRepository(RaceEvent) private events: Repository<RaceEvent>,
    @InjectRepository(User) private users: Repository<User>,
    private timeline: TimelineService,
  ) {}

  // ---------------- 预警 ----------------

  async createAlert(dto: any, user: User) {
    const race = await this.races.findOne({ where: { id: dto.raceId } });
    if (!race) throw new NotFoundException('赛事不存在');
    if (!WEATHER_KINDS[dto.kind]) throw new BadRequestException('预警类型必须为 WIND/RAIN/HEAT');

    const event = await this.events.save(
      this.events.create({
        raceId: race.id,
        type: EventType.WEATHER,
        severity: dto.severity || 'WARNING',
        title: `${WEATHER_KINDS[dto.kind].label}预警：${dto.title}`,
        description: dto.description || '',
        groupId: dto.groupIds?.length === 1 ? dto.groupIds[0] : null,
        createdById: user.id,
      }),
    );
    for (const role of [Role.REFEREE, Role.MEDICAL, Role.SUPPLY, Role.VOLUNTEER]) {
      await this.notifications.save(
        this.notifications.create({
          raceId: race.id,
          eventId: event.id,
          targetRole: role,
          title: `[WEATHER] ${WEATHER_KINDS[dto.kind].label}预警：${dto.title}`,
          message: `${dto.description || ''}（预警时段 ${dto.issuedAt}-${dto.effectiveUntil}）`,
        }),
      );
    }

    const alert = await this.alerts.save(
      this.alerts.create({
        raceId: race.id,
        kind: dto.kind,
        severity: dto.severity || 'WARNING',
        title: dto.title,
        description: dto.description || '',
        issuedAt: dto.issuedAt,
        effectiveUntil: dto.effectiveUntil,
        affectedFromKm: dto.affectedFromKm ?? null,
        affectedToKm: dto.affectedToKm ?? null,
        groupIds: dto.groupIds?.length ? dto.groupIds : null,
        eventId: event.id,
        createdById: user.id,
      }),
    );
    await this.timeline.add(
      race.id,
      TimelineType.EVENT,
      `运营收到${WEATHER_KINDS[dto.kind].label}预警：${dto.title}（${dto.issuedAt}-${dto.effectiveUntil}）→ 已通知裁判/医疗/补给/志愿者`,
      { actorId: user.id, actorName: user.displayName, groupIds: dto.groupIds || [], refType: 'weather_alert', refId: alert.id },
    );
    return alert;
  }

  async listAlerts(raceId: string) {
    const list = await this.alerts.find({ where: { raceId }, order: { createdAt: 'DESC' } });
    const sh = await this.shortenings.find({ where: { raceId }, order: { createdAt: 'DESC' } });
    const out = [];
    for (const a of list) {
      const s = sh.find((x) => x.alertId === a.id);
      out.push({ ...a, shortening: s ? await this.enrichShortening(s) : null });
    }
    return out;
  }

  // ---------------- 评估 ----------------

  private async loadCourse(raceId: string) {
    const groups = await this.groups.find({ where: { raceId }, order: { sortOrder: 'ASC' } });
    const routes = await this.routes.find({ where: { raceId } });
    const route = routes[0] || null;
    const points = route
      ? await this.points.find({ where: { routeId: route.id }, order: { sequence: 'ASC' } })
      : [];
    return { groups, route, points };
  }

  /** 计算每位在途选手（检录通过、未退赛）的当前位置 */
  private async riderPositions(raceId: string, groups: RaceGroup[], points: RoutePoint[]): Promise<RiderPos[]> {
    const regs = await this.registrations.find({ where: { raceId, status: RegStatus.APPROVED } });
    const withdrawn = new Set((await this.withdrawals.find({ where: { raceId } })).map((w) => w.registrationId));
    const result: RiderPos[] = [];
    for (const reg of regs) {
      if (withdrawn.has(reg.id)) continue;
      const ci = await this.checkIns.findOne({ where: { registrationId: reg.id } });
      if (ci?.status !== 'PASSED') continue;
      const chips = await this.chips.find({ where: { registrationId: reg.id }, order: { readAt: 'ASC' } });
      let last: ChipRecord | null = null;
      let lastPoint: RoutePoint | null = null;
      for (const c of chips) {
        const p = points.find((x) => x.id === c.routePointId);
        if (!p) continue;
        if (!lastPoint || p.sequence >= lastPoint.sequence) {
          last = c;
          lastPoint = p;
        }
      }
      result.push({
        reg,
        bib: reg.bibNumber,
        groupId: reg.groupId,
        point: lastPoint,
        km: lastPoint?.kmMark ?? 0,
        lastReadAt: last?.readAt || null,
        junctionChip: null,
        ahead: false,
      });
    }
    return result;
  }

  async assess(alertId: string, now = new Date()) {
    const alert = await this.alerts.findOne({ where: { id: alertId } });
    if (!alert) throw new NotFoundException('预警不存在');
    const race = await this.races.findOne({ where: { id: alert.raceId } });
    const { groups, route, points } = await this.loadCourse(alert.raceId);
    const targetGroups = groups.filter((g) => !alert.groupIds?.length || alert.groupIds.includes(g.id));
    const positions = await this.riderPositions(alert.raceId, groups, points);

    // 候选新终点（关键路口）：受影响赛段起点之前的计时点/交通管制点
    const affectedFrom = alert.affectedFromKm ?? Math.max(...points.map((p) => p.kmMark), 0);
    const candidates = points
      .filter((p) => p.kmMark <= affectedFrom && [PointType.TIMING, PointType.TRAFFIC_CONTROL, PointType.SUPPLY, PointType.MEDICAL].includes(p.type as PointType))
      .sort((a, b) => b.kmMark - a.kmMark);
    const junction = candidates[0] || points.filter((p) => p.kmMark < affectedFrom).sort((a, b) => b.kmMark - a.kmMark)[0] || null;

    const nowMin = now.getHours() * 60 + now.getMinutes();
    const deadlineMin = hmToMin(alert.effectiveUntil);
    const basePace = 22 * (WEATHER_KINDS[alert.kind]?.paceFactor ?? 0.8); // km/h，天气降速

    // 补给消耗
    const supplyRecs = await this.supplyRecords.find({ where: { raceId: alert.raceId } });
    const supplyByPoint = points
      .filter((p) => [PointType.SUPPLY, PointType.REPAIR].includes(p.type as PointType))
      .map((p) => {
        const recs = supplyRecs.filter((r) => r.routePointId === p.id);
        return {
          pointId: p.id,
          name: p.name,
          kmMark: p.kmMark,
          waterUsed: recs.reduce((s, r) => s + r.water, 0),
          gelsUsed: recs.reduce((s, r) => s + r.gels, 0),
          partsUsed: recs.reduce((s, r) => s + r.repairParts, 0),
          waterLeft: p.waterStock,
          gelsLeft: p.gelStock,
          partsLeft: p.partsStock,
        };
      });

    // 医疗点容量与占用
    const medRecs = await this.medicalRecords.find({ where: { raceId: alert.raceId } });
    const medicalByPoint = points
      .filter((p) => p.type === PointType.MEDICAL)
      .map((p) => {
        const active = medRecs.filter(
          (r) => r.routePointId === p.id && r.severity !== 'MINOR' && !/送医|退赛/.test(r.outcome || ''),
        );
        return {
          pointId: p.id,
          name: p.name,
          kmMark: p.kmMark,
          capacity: p.medicalCapacity,
          occupied: active.length,
          free: Math.max(0, p.medicalCapacity - active.length),
        };
      });

    // 交通管制剩余
    const traffic = points
      .filter((p) => p.trafficControlEnd)
      .map((p) => ({
        pointId: p.id,
        name: p.name,
        kmMark: p.kmMark,
        controlEnd: p.trafficControlEnd,
        remainingMin: hmToMin(p.trafficControlEnd)! - nowMin,
        expired: hmToMin(p.trafficControlEnd)! <= nowMin,
      }))
      .sort((a, b) => a.remainingMin - b.remainingMin);

    // 分组评估 + 建议关门时间
    const perGroup = targetGroups.map((g) => {
      const riders = positions.filter((r) => r.groupId === g.id);
      const ahead = junction ? riders.filter((r) => r.km >= junction.kmMark) : [];
      const behind = junction ? riders.filter((r) => r.km < junction.kmMark) : riders;
      ahead.forEach((r) => (r.ahead = true));
      const furthestBehindKm = behind.reduce((m, r) => Math.max(m, r.km), 0);
      const etaMin = junction
        ? Math.round(((junction.kmMark - furthestBehindKm) / Math.max(basePace, 1)) * 60) + 10
        : 10;
      let recommendedMin = nowMin + etaMin;
      if (deadlineMin != null) recommendedMin = Math.min(recommendedMin, deadlineMin - 15);
      // 不能晚于新终点（关键路口）仍生效的交通管制结束时间
      const junctionControl = traffic
        .filter((t) => junction && t.kmMark <= junction.kmMark && !t.expired)
        .sort((a, b) => a.remainingMin - b.remainingMin)[0];
      if (junctionControl) recommendedMin = Math.min(recommendedMin, hmToMin(junctionControl.controlEnd)!);
      const recommendedCutoff = behind.length ? minToHm(recommendedMin) : minToHm(nowMin + 10);

      // 补给需求：未通过关键路口选手汇集到新终点
      const waterDemand = behind.length;
      const gelDemand = Math.ceil(behind.length / 2);
      // 医疗保障：关键路口之前最近医疗点
      const med = medicalByPoint.filter((m) => !junction || m.kmMark <= junction.kmMark).sort((a, b) => b.kmMark - a.kmMark)[0] || null;
      // 管制约束：关键路口之前仍生效管制中最早结束者
      const ctrl = junctionControl || null;
      const controlRisk = ctrl ? ctrl.remainingMin < etaMin : false;

      return {
        groupId: g.id,
        groupName: g.name,
        startTime: g.startTime,
        onCourse: riders.length,
        aheadCount: ahead.length,
        behindCount: behind.length,
        aheadBibs: ahead.map((r) => r.bib),
        behindBibs: behind.map((r) => r.bib),
        behindRiders: behind.map((r) => ({ bib: r.bib, km: r.km, lastPoint: r.point?.name || '起点之后', lastReadAt: r.lastReadAt })),
        furthestBehindKm,
        etaMin,
        recommendedCutoff,
        waterDemand,
        gelDemand,
        medical: med,
        traffic: ctrl ? { ...ctrl, enoughForClearance: !controlRisk } : null,
        controlRisk,
      };
    });

    return {
      alert: { id: alert.id, kind: alert.kind, kindLabel: WEATHER_KINDS[alert.kind].label, title: alert.title, issuedAt: alert.issuedAt, effectiveUntil: alert.effectiveUntil, affectedFromKm: alert.affectedFromKm, affectedToKm: alert.affectedToKm },
      race: { id: race.id, name: race.name, raceDate: race.raceDate },
      route: route ? { id: route.id, name: route.name } : null,
      junction: junction ? { id: junction.id, name: junction.name, type: junction.type, kmMark: junction.kmMark, staffed: junction.staffed } : null,
      candidates: candidates.map((c) => ({ id: c.id, name: c.name, type: c.type, kmMark: c.kmMark, staffed: c.staffed })),
      groups: perGroup,
      supply: supplyByPoint,
      medical: medicalByPoint,
      traffic,
      factors: [
        `依据各组选手最新芯片位置判定已通过/未通过关键路口（共 ${positions.length} 名在途选手）`,
        `补给消耗按已登记发放记录汇总，新终点需为未通过选手预留饮水/能量胶`,
        `医疗容量取医疗点容量减去在治中重度伤情人数`,
        `交通管制剩余按当前时间 ${minToHm(nowMin)} 与各点位管制结束时间计算`,
        `${WEATHER_KINDS[alert.kind].label}天气下预计均速折减为 ${basePace.toFixed(1)}km/h，关门时间=最慢选手抵达预计+10 分钟缓冲，且不晚于预警解除前 15 分钟`,
      ],
    };
  }

  // ---------------- 方案提交 / 裁判确认 ----------------

  async propose(dto: any, user: User) {
    const alert = await this.alerts.findOne({ where: { id: dto.alertId } });
    if (!alert) throw new NotFoundException('预警不存在');
    const dup = await this.shortenings.findOne({ where: { raceId: alert.raceId, status: In(['PROPOSED', 'CONFIRMED']) } });
    if (dup) throw new BadRequestException('该赛事已有待确认或已生效的赛段缩短方案');
    const { points } = await this.loadCourse(alert.raceId);
    const junction = points.find((p) => p.id === dto.newFinishPointId);
    if (!junction) throw new BadRequestException('新终点（关键路口）不存在');

    const assessment = await this.assess(alert.id);
    const plan = assessment.groups.map((g: any) => ({
      groupId: g.groupId,
      groupName: g.groupName,
      cutoffTime: dto.cutoffByGroup?.[g.groupId] || g.recommendedCutoff,
      ridersAhead: g.aheadCount,
      ridersBehind: g.behindCount,
      aheadBibs: g.aheadBibs,
      behindBibs: g.behindBibs,
    }));
    const groupIds = dto.groupIds?.length ? dto.groupIds : assessment.groups.map((g: any) => g.groupId);

    const s = await this.shortenings.save(
      this.shortenings.create({
        raceId: alert.raceId,
        alertId: alert.id,
        newFinishPointId: junction.id,
        cutoffPlanJson: JSON.stringify(plan),
        status: 'PROPOSED',
        groupIds,
        assessmentSummary: assessment.factors.join('；'),
        proposedById: user.id,
        proposedAt: new Date(),
      }),
    );
    const earliest = plan.map((p: any) => hmToMin(p.cutoffTime)!).sort((a, b) => a - b)[0];
    await this.timeline.add(
      alert.raceId,
      TimelineType.STAGE_SHORTENING,
      `运营提交赛段缩短方案：新终点「${junction.name}」（${junction.kmMark}km），最早关门 ${minToHm(earliest)}，待裁判确认`,
      { actorId: user.id, actorName: user.displayName, groupIds, refType: 'stage_shortening', refId: s.id },
    );
    return this.enrichShortening(s);
  }

  async listForRace(raceId: string) {
    const list = await this.shortenings.find({ where: { raceId }, order: { createdAt: 'DESC' } });
    const out = [];
    for (const s of list) out.push(await this.enrichShortening(s));
    return out;
  }

  async enrichShortening(s: StageShortening) {
    const junction = await this.points.findOne({ where: { id: s.newFinishPointId } });
    const alert = await this.alerts.findOne({ where: { id: s.alertId } });
    const tasks = await this.tasks.find({ where: { shorteningId: s.id }, order: { createdAt: 'ASC' } });
    return {
      ...s,
      cutoffPlan: JSON.parse(s.cutoffPlanJson),
      junction: junction ? { id: junction.id, name: junction.name, type: junction.type, kmMark: junction.kmMark } : null,
      alert: alert ? { id: alert.id, kind: alert.kind, kindLabel: WEATHER_KINDS[alert.kind]?.label, title: alert.title } : null,
      tasks,
    };
  }

  async confirm(id: string, user: User, note = '') {
    const s = await this.shortenings.findOne({ where: { id } });
    if (!s) throw new NotFoundException('缩短方案不存在');
    if (s.status !== 'PROPOSED') throw new BadRequestException('方案已处理，不能重复确认');
    const race = await this.races.findOne({ where: { id: s.raceId } });
    const alert = await this.alerts.findOne({ where: { id: s.alertId } });
    const { groups, points } = await this.loadCourse(s.raceId);
    const junction = points.find((p) => p.id === s.newFinishPointId)!;
    const plan = JSON.parse(s.cutoffPlanJson) as any[];
    const groupIds = s.groupIds?.length ? s.groupIds : groups.map((g) => g.id);
    const affectedGroups = groups.filter((g) => groupIds.includes(g.id));
    const earliestMin = plan.map((p) => hmToMin(p.cutoffTime)!).sort((a, b) => a - b)[0];
    const earliest = minToHm(earliestMin);

    // 1) 关门时间下发：关键路口及其之前仍启用岗位写入新关门时间；关键路口之后的点位撤销
    const activePosts: RoutePoint[] = [];
    const evacuatedPosts: RoutePoint[] = [];
    for (const p of points) {
      if (p.kmMark <= junction.kmMark) {
        p.cutoffTime = earliest;
        activePosts.push(p);
      } else {
        p.cutoffTime = earliest;
        p.isActive = false;
        evacuatedPosts.push(p);
      }
    }
    junction.cutoffTime = earliest;
    await this.points.save(points);

    // 2) 通知各岗位与选手新关门时间
    for (const g of affectedGroups) {
      const row = plan.find((p) => p.groupId === g.id);
      await this.notifications.save(
        this.notifications.create({
          raceId: s.raceId,
          targetRole: Role.RIDER,
          targetGroupId: g.id,
          title: '【赛段缩短】新关门时间与新终点',
          message: `因${alert ? WEATHER_KINDS[alert.kind]?.label : '天气'}天气，赛段缩短：新终点为「${junction.name}」（${junction.kmMark}km），本组关门时间 ${row?.cutoffTime || earliest}。已通过该路口者按过点时间记录成绩，未通过者须在关门前到达。`,
        }),
      );
    }
    for (const role of [Role.SUPPLY, Role.VOLUNTEER, Role.MEDICAL, Role.CHECKIN, Role.REFEREE]) {
      await this.notifications.save(
        this.notifications.create({
          raceId: s.raceId,
          targetRole: role,
          title: '【赛段缩短·已确认】请签收新关门时间',
          message: `新终点「${junction.name}」（${junction.kmMark}km），各组关门 ${plan.map((p) => `${p.groupName} ${p.cutoffTime}`).join('；')}。请相关岗位立即按任务单调整站位并签收。`,
        }),
      );
    }

    // 3) 成绩分类：决定生效时已过关键路口 vs 未通过
    const positions = await this.riderPositions(s.raceId, groups, points);
    const allChips = await this.chips.find({ where: { raceId: s.raceId }, order: { readAt: 'ASC' } });
    const startPoint = points.find((p) => p.type === PointType.START);
    const finishPoint = points.find((p) => p.type === PointType.FINISH);
    const aheadCount = { n: 0 };
    const behindCount = { n: 0 };
    for (const r of positions) {
      if (!groupIds.includes(r.groupId)) continue;
      const myChips = allChips.filter((c) => c.registrationId === r.reg.id);
      // 已在原终点正常完赛者保留正常成绩，不受缩短改写
      const alreadyFinished = myChips.some((c) => c.routePointId === finishPoint?.id);
      if (alreadyFinished) continue;
      const atJunction = myChips.filter((c) => c.routePointId === junction.id).sort((a, b) => +new Date(a.readAt) - +new Date(b.readAt));
      let result = await this.results.findOne({ where: { registrationId: r.reg.id } });
      if (!result) result = this.results.create({ registrationId: r.reg.id, raceId: s.raceId, groupId: r.groupId });
      if (r.km >= junction.kmMark) {
        // 已通过关键路口：按通过该路口的时间计成绩（无该点芯片则取最近过点时间）
        const group = groups.find((g) => g.id === r.groupId);
        const startChip = startPoint ? myChips.find((c) => c.routePointId === startPoint.id) : null;
        const startedAt = startChip?.readAt || (group?.startTime ? new Date(`${race.raceDate}T${group.startTime}:00`) : null);
        const passAt = atJunction[0]?.readAt || r.lastReadAt;
        result.status = 'FINISHED';
        result.resultRule = 'PASSED_JUNCTION';
        result.shorteningId = s.id;
        result.startedAt = startedAt;
        result.finishedAt = passAt;
        result.junctionPassedAt = passAt;
        result.netSeconds = startedAt && passAt ? Math.max(0, Math.round((+new Date(passAt) - +new Date(startedAt)) / 1000)) : null;
        aheadCount.n++;
      } else {
        // 未通过：进入关门核验，关门前到达按关门点成绩，超时记 DNF
        result.status = 'FINISHED';
        result.resultRule = 'BEHIND_CUTOFF';
        result.shorteningId = s.id;
        result.netSeconds = null;
        behindCount.n++;
      }
      await this.results.save(result);
    }

    // 4) 重新生成任务：补给物资 / 接驳车辆 / 志愿者站位
    const taskIds: string[] = [];
    const mkTask = async (partial: Partial<ShorteningTask>) => {
      const t = await this.tasks.save(
        this.tasks.create({ raceId: s.raceId, shorteningId: s.id, status: 'PENDING', ...partial } as ShorteningTask),
      );
      taskIds.push(t.id);
      return t;
    };

    // 4.1 补给物资：撤销路段库存前移到新终点/最近补给点
    const targetSupply =
      [PointType.SUPPLY, PointType.REPAIR].includes(junction.type as PointType)
        ? junction
        : activePosts.filter((p) => [PointType.SUPPLY, PointType.REPAIR].includes(p.type as PointType)).sort((a, b) => b.kmMark - a.kmMark)[0];
    const sources = evacuatedPosts.filter((p) => [PointType.SUPPLY, PointType.REPAIR].includes(p.type as PointType) && (p.waterStock + p.gelStock + p.partsStock > 0));
    let movedWater = 0;
    let movedGels = 0;
    let movedParts = 0;
    for (const src of sources) {
      movedWater += src.waterStock;
      movedGels += src.gelStock;
      movedParts += src.partsStock;
      src.waterStock = 0;
      src.gelStock = 0;
      src.partsStock = 0;
    }
    if (movedWater + movedGels + movedParts > 0) {
      if (targetSupply) {
        targetSupply.waterStock += movedWater;
        targetSupply.gelStock += movedGels;
        targetSupply.partsStock += movedParts;
        await this.points.save(targetSupply);
      }
      await this.points.save(sources);
      await mkTask({
        kind: 'SUPPLY',
        targetRole: Role.SUPPLY,
        routePointId: targetSupply?.id || junction.id,
        title: `补给物资前移至${targetSupply ? `「${targetSupply.name}」` : `新终点「${junction.name}」临时点`}`,
        detail: `从撤销路段 ${sources.map((x) => x.name).join('、')} 前移：饮水 ${movedWater} 瓶、能量胶 ${movedGels} 支、配件 ${movedParts} 件；优先保障 ${plan.reduce((n, p) => n + p.ridersBehind, 0)} 名未过关键路口选手。`,
      });
    }

    // 4.2 接驳车辆：未通过选手 + 撤销点位收尾
    for (const row of plan) {
      if (row.ridersBehind > 0) {
        await mkTask({
          kind: 'SHUTTLE',
          targetRole: Role.VOLUNTEER,
          routePointId: junction.id,
          title: `${row.groupName} 接驳：${row.ridersBehind} 名未过关键路口选手`,
          detail: `新终点「${junction.name}」集结，关门 ${row.cutoffTime} 后接驳超时选手；号码：${row.behindBibs.join('、') || '无'}。`,
        });
      }
    }
    for (const p of evacuatedPosts.filter((x) => x.staffed)) {
      await mkTask({
        kind: 'SHUTTLE',
        targetRole: Role.VOLUNTEER,
        routePointId: p.id,
        title: `收尾接驳：撤回「${p.name}」岗位与滞留物资`,
        detail: `该点位位于撤销路段（${p.kmMark}km），请安排车辆接回岗位人员、帐篷与剩余物资。`,
      });
    }

    // 4.3 志愿者站位：新终点引导/关门、医疗点保障
    await mkTask({
      kind: 'STATION',
      targetRole: Role.VOLUNTEER,
      routePointId: junction.id,
      title: `新终点站位：「${junction.name}」引导与关门核验`,
      detail: `指挥已通过选手靠边停止计时，引导未通过选手 ${earliest} 前通过，设置折返/禁行标识。`,
    });
    const activeMed = activePosts.filter((p) => p.type === PointType.MEDICAL);
    for (const m of activeMed) {
      await mkTask({
        kind: 'STATION',
        targetRole: Role.VOLUNTEER,
        routePointId: m.id,
        title: `医疗保障站位前置：「${m.name}」`,
        detail: `预留救护车通道，配合容量 ${m.medicalCapacity} 人做好接驳与转诊准备。`,
      });
    }

    // 4.4 未接到通知的岗位：撤销路段无人值守点（无法当面送达新关门时间）
    const unnotifiedPosts = evacuatedPosts.filter((p) => !p.staffed);
    for (const p of unnotifiedPosts) {
      await mkTask({
        kind: 'STATION',
        targetRole: Role.VOLUNTEER,
        routePointId: p.id,
        title: `⚠ 未接到通知岗位：「${p.name}」（${p.kmMark}km）`,
        detail: `该点位无在岗人员，新关门时间无法签收；请立即电话/对讲联络责任人并派人现场封路，防止选手误入撤销路段。`,
        unnotified: true,
        status: 'UNNOTIFIED',
      });
    }

    // 5) 落库方案与岗位签收清单
    s.status = 'CONFIRMED';
    s.confirmedById = user.id;
    s.confirmedAt = new Date();
    s.notifiedPostIds = activePosts.filter((p) => p.staffed).map((p) => p.id);
    s.acknowledgedPostIds = [];
    s.taskIds = taskIds;
    await this.shortenings.save(s);

    // 6) 时间轴
    await this.timeline.add(
      s.raceId,
      TimelineType.STAGE_SHORTENING,
      `裁判确认赛段缩短：新终点「${junction.name}」（${junction.kmMark}km）；关门 ${plan.map((p) => `${p.groupName} ${p.cutoffTime}`).join('；')}；已通过关键路口 ${aheadCount.n} 人按过点计时，未通过 ${behindCount.n} 人进入关门核验；重生成任务 ${taskIds.length} 项，未接到通知岗位 ${unnotifiedPosts.length} 个${note ? `；裁判备注：${note}` : ''}`,
      { actorId: user.id, actorName: user.displayName, groupIds, refType: 'stage_shortening', refId: s.id },
    );
    for (const r of positions) {
      if (!groupIds.includes(r.groupId) || r.km < junction.kmMark) continue;
      const result = await this.results.findOne({ where: { registrationId: r.reg.id } });
      await this.timeline.add(
        s.raceId,
        TimelineType.RESULT,
        `赛段缩短成绩：号码 ${r.bib} 决定生效时已通过关键路口，按过点时间记录（${RESULT_RULES.PASSED_JUNCTION}）${result?.netSeconds != null ? `，净用时 ${this.fmt(result.netSeconds)}` : ''}`,
        { actorId: user.id, actorName: user.displayName, groupIds: [r.groupId], refType: 'result', refId: result?.id },
      );
    }
    if (unnotifiedPosts.length) {
      await this.timeline.add(
        s.raceId,
        TimelineType.STAGE_SHORTENING,
        `岗位通知缺口：${unnotifiedPosts.map((p) => `「${p.name}」`).join('、')} 无在岗人员，新关门时间未送达，已生成紧急封路任务`,
        { actorId: user.id, actorName: user.displayName, groupIds, refType: 'stage_shortening', refId: s.id },
      );
    }
    return this.enrichShortening(s);
  }

  /** 关门核验：未通过关键路口选手在新终点的芯片记录 → 关门前=关门点成绩；超时=DNF */
  async verifyCutoff(
    id: string,
    user: User,
    opts: { regId?: string; readAt?: Date; markMissed?: boolean } = {},
  ) {
    const s = await this.shortenings.findOne({ where: { id } });
    if (!s) throw new NotFoundException('缩短方案不存在');
    if (s.status !== 'CONFIRMED') throw new BadRequestException('方案尚未确认');
    const race = await this.races.findOne({ where: { id: s.raceId } });
    const { groups, points } = await this.loadCourse(s.raceId);
    const junction = points.find((p) => p.id === s.newFinishPointId)!;
    const plan = JSON.parse(s.cutoffPlanJson) as any[];
    const startPoint = points.find((p) => p.type === PointType.START);
    const allChips = await this.chips.find({ where: { raceId: s.raceId }, order: { readAt: 'ASC' } });

    let pending = await this.results.find({ where: { raceId: s.raceId, resultRule: 'BEHIND_CUTOFF' } });
    if (opts.regId) pending = pending.filter((r) => r.registrationId === opts.regId);
    let finalized = 0;
    let missed = 0;
    for (const result of pending) {
      const row = plan.find((p) => p.groupId === result.groupId);
      const cutoff = hmToMin(row?.cutoffTime || '');
      const myChips = allChips
        .filter((c) => c.registrationId === result.registrationId && c.routePointId === junction.id)
        .map((c) => c.readAt);
      if (opts.regId && opts.readAt) myChips.push(opts.readAt);
      const pass = myChips.sort((a, b) => +new Date(a) - +new Date(b))[0];
      const reg = await this.registrations.findOne({ where: { id: result.registrationId } });
      if (pass && cutoff != null) {
        const passMin = new Date(pass).getHours() * 60 + new Date(pass).getMinutes();
        if (passMin <= cutoff) {
          const group = groups.find((g) => g.id === result.groupId);
          const startChip = startPoint ? allChips.find((c) => c.registrationId === result.registrationId && c.routePointId === startPoint.id) : null;
          const startedAt = startChip?.readAt || (group?.startTime ? new Date(`${race.raceDate}T${group.startTime}:00`) : null);
          result.status = 'FINISHED';
          result.resultRule = 'PASSED_CUTOFF';
          result.startedAt = startedAt;
          result.finishedAt = pass;
          result.netSeconds = startedAt ? Math.max(0, Math.round((+new Date(pass) - +new Date(startedAt)) / 1000)) : null;
          await this.results.save(result);
          finalized++;
          await this.timeline.add(
            s.raceId,
            TimelineType.RESULT,
            `关门核验通过：号码 ${reg?.bibNumber} 于 ${minToHm(passMin)} 抵达新终点（关门 ${row?.cutoffTime}），按关门点成绩计${result.netSeconds != null ? ' ' + this.fmt(result.netSeconds) : ''}`,
            { actorId: user.id, actorName: user.displayName, groupIds: [result.groupId], refType: 'result', refId: result.id },
          );
          continue;
        }
        // 有过点记录但已超关门时间 → DNF
        result.status = 'DNF';
        await this.results.save(result);
        missed++;
        await this.timeline.add(
          s.raceId,
          TimelineType.RESULT,
          `关门超时：号码 ${reg?.bibNumber} 于 ${minToHm(passMin)} 才通过新终点（关门 ${row?.cutoffTime}），成绩记 DNF`,
          { actorId: user.id, actorName: user.displayName, groupIds: [result.groupId], refType: 'result', refId: result.id },
        );
        continue;
      }
      // 显式批量关门：到点仍无过点记录 → DNF
      if (opts.markMissed && cutoff != null && !pass) {
        result.status = 'DNF';
        await this.results.save(result);
        missed++;
        await this.timeline.add(
          s.raceId,
          TimelineType.RESULT,
          `关门超时：号码 ${reg?.bibNumber} 未在 ${row?.cutoffTime} 前通过新终点「${junction.name}」，成绩记 DNF`,
          { actorId: user.id, actorName: user.displayName, groupIds: [result.groupId], refType: 'result', refId: result.id },
        );
      }
    }
    return { finalized, missed };
  }

  // ---------------- 岗位签收 / 任务 ----------------

  async ackPost(shorteningId: string, routePointId: string, user: User) {
    const s = await this.shortenings.findOne({ where: { id: shorteningId } });
    if (!s) throw new NotFoundException('缩短方案不存在');
    if (s.status !== 'CONFIRMED') throw new BadRequestException('方案尚未确认');
    const ack = new Set(s.acknowledgedPostIds || []);
    ack.add(routePointId);
    s.acknowledgedPostIds = [...ack];
    await this.shortenings.save(s);
    const point = await this.points.findOne({ where: { id: routePointId } });
    await this.timeline.add(
      s.raceId,
      TimelineType.STAGE_SHORTENING,
      `岗位签收：「${point?.name || routePointId}」已确认收到新关门时间（${user.displayName}）`,
      { actorId: user.id, actorName: user.displayName, refType: 'stage_shortening', refId: s.id },
    );
    return this.enrichShortening(s);
  }

  async taskBoard(raceId: string) {
    const list = await this.shortenings.find({ where: { raceId }, order: { createdAt: 'DESC' } });
    if (!list.length) return { shortenings: [], tasks: [], posts: [] };
    const s = list[0];
    const enriched = await this.enrichShortening(s);
    const { points } = await this.loadCourse(raceId);
    const posts = points.map((p) => ({
      pointId: p.id,
      name: p.name,
      type: p.type,
      kmMark: p.kmMark,
      role: POST_ROLE_BY_TYPE[p.type] || Role.VOLUNTEER,
      active: p.isActive,
      staffed: p.staffed,
      cutoffTime: p.cutoffTime,
      notified: (s.notifiedPostIds || []).includes(p.id),
      acknowledged: (s.acknowledgedPostIds || []).includes(p.id),
      unnotified: !p.isActive && !p.staffed,
    }));
    return { shortenings: [enriched], tasks: enriched.tasks, posts, current: enriched };
  }

  async completeTask(taskId: string, user: User, note = '') {
    const t = await this.tasks.findOne({ where: { id: taskId } });
    if (!t) throw new NotFoundException('任务不存在');
    t.status = 'DONE';
    t.completedById = user.id;
    t.completedAt = new Date();
    if (note) t.detail = `${t.detail}${t.detail ? '；' : ''}完成备注：${note}`;
    await this.tasks.save(t);
    await this.timeline.add(
      t.raceId,
      TimelineType.STAGE_SHORTENING,
      `任务完成：${t.title}${note ? `（${note}）` : ''}`,
      { actorId: user.id, actorName: user.displayName, refType: 'shortening_task', refId: t.id },
    );
    return t;
  }

  async confirmedForRace(raceId: string): Promise<StageShortening | null> {
    return this.shortenings.findOne({ where: { raceId, status: 'CONFIRMED' }, order: { confirmedAt: 'DESC' } });
  }

  private fmt(sec: number) {
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s2 = sec % 60;
    return `${h}:${String(m).padStart(2, '0')}:${String(s2).padStart(2, '0')}`;
  }
}
