import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import {
  Appeal,
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
  RoutePointGroup,
  SupplyRecord,
  TimelineEntry,
  TimelineType,
  User,
  Withdrawal,
} from '../entities';

@Injectable()
export class SeedService implements OnApplicationBootstrap {
  private logger = new Logger('Seed');

  constructor(
    @InjectRepository(User) private users: Repository<User>,
    @InjectRepository(RiderProfile) private profiles: Repository<RiderProfile>,
    @InjectRepository(Race) private races: Repository<Race>,
    @InjectRepository(RaceGroup) private groups: Repository<RaceGroup>,
    @InjectRepository(Registration) private registrations: Repository<Registration>,
    @InjectRepository(RaceRoute) private routes: Repository<RaceRoute>,
    @InjectRepository(RoutePoint) private points: Repository<RoutePoint>,
    @InjectRepository(RoutePointGroup) private pointGroups: Repository<RoutePointGroup>,
    @InjectRepository(CheckIn) private checkIns: Repository<CheckIn>,
    @InjectRepository(SupplyRecord) private supplyRecords: Repository<SupplyRecord>,
    @InjectRepository(RaceEvent) private events: Repository<RaceEvent>,
    @InjectRepository(Notification) private notifications: Repository<Notification>,
    @InjectRepository(Withdrawal) private withdrawals: Repository<Withdrawal>,
    @InjectRepository(ChipRecord) private chips: Repository<ChipRecord>,
    @InjectRepository(RaceResult) private results: Repository<RaceResult>,
    @InjectRepository(MedicalRecord) private medicalRecords: Repository<MedicalRecord>,
    @InjectRepository(Appeal) private appeals: Repository<Appeal>,
    @InjectRepository(TimelineEntry) private timeline: Repository<TimelineEntry>,
  ) {}

  async onApplicationBootstrap() {
    const count = await this.users.count();
    if (count > 0) return;
    this.logger.log('数据库为空，写入演示种子数据...');
    await this.seed();
    this.logger.log('种子数据完成。测试账号：admin/Admin@123, referee/Referee@123, medic/Medic@123, checkin/Checkin@123, supply/Supply@123, volunteer/Volunteer@123, rider1..rider8/Rider@123');
  }

  private async user(username: string, password: string, displayName: string, role: Role) {
    return this.users.save(
      this.users.create({ username, passwordHash: await bcrypt.hash(password, 10), displayName, role }),
    );
  }

  private async tl(raceId: string, type: TimelineType, message: string, opts: any = {}) {
    const e = this.timeline.create({
      raceId,
      type,
      message,
      actorId: opts.actorId || null,
      actorName: opts.actorName || '',
      affectedGroupIds: opts.groupIds?.length ? opts.groupIds : null,
      refType: opts.refType || null,
      refId: opts.refId || null,
    });
    if (opts.createdAt) (e as any).createdAt = opts.createdAt;
    return this.timeline.save(e);
  }

  private async seed() {
    // ---------- 用户 ----------
    const admin = await this.user('admin', 'Admin@123', '赛事运营·王磊', Role.OPS);
    const referee = await this.user('referee', 'Referee@123', '裁判长·郑军', Role.REFEREE);
    const medic = await this.user('medic', 'Medic@123', '医疗官·林芳', Role.MEDICAL);
    const checkin = await this.user('checkin', 'Checkin@123', '检录员·小周', Role.CHECKIN);
    const supply = await this.user('supply', 'Supply@123', '补给员·阿豪', Role.SUPPLY);
    const volunteer = await this.user('volunteer', 'Volunteer@123', '志愿者·小杨', Role.VOLUNTEER);

    const riderDefs: Array<[string, string, Partial<RiderProfile>]> = [
      ['rider1', '张伟', { gender: 'M', birthDate: '1998-03-12', experienceYears: 6, vehicleType: 'ROAD', healthConditions: '', insuranceValidUntil: '2027-05-01', historicalResults: '2025 环湖赛精英组第 8 名' }],
      ['rider2', '李娜', { gender: 'F', birthDate: '1992-07-25', experienceYears: 4, vehicleType: 'ROAD', healthConditions: '', insuranceValidUntil: '2027-01-01', historicalResults: '2024 城市绕圈赛女子组第 3 名' }],
      ['rider3', '王强', { gender: 'M', birthDate: '1981-11-02', experienceYears: 2, vehicleType: 'MOUNTAIN', healthConditions: '', insuranceValidUntil: '2026-12-31', historicalResults: '' }],
      ['rider4', '赵敏', { gender: 'F', birthDate: '1974-05-18', experienceYears: 8, vehicleType: 'ROAD', healthConditions: '高血压，长期服药控制良好', insuranceValidUntil: '2027-03-15', historicalResults: '2023 大师组完赛' }],
      ['rider5', '刘洋', { gender: 'M', birthDate: '2011-09-30', experienceYears: 1, vehicleType: 'MOUNTAIN', healthConditions: '', insuranceValidUntil: '2027-06-30', historicalResults: '' }],
      ['rider6', '陈静', { gender: 'F', birthDate: '1996-02-14', experienceYears: 1, vehicleType: 'ROAD', healthConditions: '', insuranceValidUntil: '2026-10-01', historicalResults: '' }],
      ['rider7', '孙鹏', { gender: 'M', birthDate: '2006-08-08', experienceYears: 0, vehicleType: 'ROAD', healthConditions: '', insuranceValidUntil: '2027-02-28', historicalResults: '' }],
      ['rider8', '周杰', { gender: 'M', birthDate: '1990-12-01', experienceYears: 3, vehicleType: 'GRAVEL', healthConditions: '', insuranceValidUntil: '2027-08-20', historicalResults: '2025  gravel 挑战赛完赛' }],
    ];
    const riders: Record<string, User> = {};
    for (const [username, name, extra] of riderDefs) {
      const u = await this.user(username, 'Rider@123', name, Role.RIDER);
      riders[username] = u;
      await this.profiles.save(
        this.profiles.create({
          userId: u.id,
          fullName: name,
          gender: 'M',
          birthDate: '1995-01-01',
          idType: '身份证',
          idNumber: `1101**${String(1000 + Object.keys(riders).length)}`,
          phone: '138****0000',
          experienceYears: 0,
          vehicleType: 'ROAD',
          emergencyContactName: '家属',
          emergencyContactPhone: '139****1111',
          healthCommitment: true,
          healthConditions: '',
          historicalResults: '',
          insuranceProvider: '平安保险',
          insurancePolicyNo: `PA2026${String(10000 + Object.keys(riders).length)}`,
          insuranceValidUntil: '2027-01-01',
          ...extra,
        } as Partial<RiderProfile>),
      );
    }

    // ---------- 赛事 A：报名中（可走完整流程） ----------
    const raceA = await this.races.save(
      this.races.create({
        name: '2026 城市环骑挑战赛',
        description: '年度城市公路骑行赛事，环城一圈 60km，设精英/大众/女子/体验四个组别。',
        raceDate: '2026-09-20',
        location: '市民广场 - 奥体中心',
        status: RaceStatus.REGISTRATION_OPEN,
      }),
    );
    const gA1 = await this.groups.save(this.groups.create({ raceId: raceA.id, name: '精英组', code: 'A', minAge: 18, maxAge: 40, allowedVehicleTypes: ['ROAD'], minExperienceYears: 3, capacity: 50, requiresInsurance: true, maxMedicalRisk: 'LOW', startTime: '08:00', sortOrder: 1 }));
    const gA2 = await this.groups.save(this.groups.create({ raceId: raceA.id, name: '大众组', code: 'B', minAge: 16, maxAge: 65, allowedVehicleTypes: ['ROAD', 'MOUNTAIN', 'GRAVEL'], minExperienceYears: 0, capacity: 200, requiresInsurance: true, maxMedicalRisk: 'MEDIUM', startTime: '08:30', sortOrder: 2 }));
    const gA3 = await this.groups.save(this.groups.create({ raceId: raceA.id, name: '女子组', code: 'C', minAge: 16, maxAge: 60, allowedVehicleTypes: ['ROAD', 'MOUNTAIN'], minExperienceYears: 0, capacity: 100, requiresInsurance: true, maxMedicalRisk: 'MEDIUM', startTime: '08:40', sortOrder: 3 }));
    const gA4 = await this.groups.save(this.groups.create({ raceId: raceA.id, name: '体验组', code: 'D', minAge: 12, maxAge: 17, allowedVehicleTypes: ['MOUNTAIN', 'FOLDING'], minExperienceYears: 0, capacity: 80, requiresInsurance: true, maxMedicalRisk: 'LOW', startTime: '09:00', sortOrder: 4 }));

    const routeA = await this.routes.save(
      this.routes.create({ raceId: raceA.id, name: '城市环线 60km', distanceKm: 60, status: 'DRAFT', notes: '途经滨江大道、北山爬坡段、森林公园。' }),
    );
    const ptsA = [
      { type: PointType.START, name: '起点·市民广场', kmMark: 0, sequence: 1, trafficControlStart: '07:00', trafficControlEnd: '09:30', description: '集结、检录、发车区' },
      { type: PointType.SUPPLY, name: '补给点1·滨江大道', kmMark: 15, sequence: 2, trafficControlStart: '07:30', trafficControlEnd: '11:00', waterStock: 300, gelStock: 200, description: '饮水+能量胶' },
      { type: PointType.CLIMB, name: '爬坡段·北山索道', kmMark: 22, sequence: 3, trafficControlStart: '08:00', trafficControlEnd: '11:30', description: '2.8km 平均坡度 6%，注意下坡控速' },
      { type: PointType.TIMING, name: '计时点1·山顶', kmMark: 28, sequence: 4, description: '爬坡计时点' },
      { type: PointType.REPAIR, name: '维修点·山脚驿站', kmMark: 35, sequence: 5, trafficControlStart: '08:30', trafficControlEnd: '12:00', partsStock: 50, description: '备胎/链条/打气' },
      { type: PointType.MEDICAL, name: '医疗点·森林公园', kmMark: 40, sequence: 6, trafficControlStart: '08:30', trafficControlEnd: '12:30', description: '救护车驻点' },
      { type: PointType.SUPPLY, name: '补给点2·湖畔路', kmMark: 45, sequence: 7, trafficControlStart: '09:00', trafficControlEnd: '12:30', waterStock: 300, gelStock: 150, description: '饮水+能量胶' },
      { type: PointType.TIMING, name: '计时点2·入城口', kmMark: 52, sequence: 8, description: '入城计时点' },
      { type: PointType.FINISH, name: '终点·奥体中心', kmMark: 60, sequence: 9, trafficControlStart: '09:00', trafficControlEnd: '13:00', description: '冲刺区、颁奖区' },
    ];
    const savedPtsA: RoutePoint[] = [];
    for (const p of ptsA) {
      savedPtsA.push(await this.points.save(this.points.create({ ...p, routeId: routeA.id } as Partial<RoutePoint>)));
    }
    // 点位关联组别：爬坡段与计时点1 仅精英/大众/女子组经过（体验组走绕城短线）
    const climb = savedPtsA[2];
    const timing1 = savedPtsA[3];
    for (const g of [gA1, gA2, gA3]) {
      await this.pointGroups.save(this.pointGroups.create({ routePointId: climb.id, groupId: g.id }));
      await this.pointGroups.save(this.pointGroups.create({ routePointId: timing1.id, groupId: g.id }));
    }

    // 报名（系统评估逻辑的种子版：直接落库为评估后的状态）
    const regA = async (rider: User, group: RaceGroup, status: RegStatus, reason: string, risk: string, bib?: string) => {
      const reg = await this.registrations.save(
        this.registrations.create({
          raceId: raceA.id,
          groupId: group.id,
          riderId: rider.id,
          status,
          decisionReason: reason,
          medicalRisk: risk,
          bibNumber: bib || '',
          chipId: bib ? `CHIP-${bib}` : '',
        }),
      );
      await this.tl(raceA.id, TimelineType.REGISTRATION, `${rider.displayName} 报名「${group.name}」→ ${status}（${reason}）`, {
        actorId: rider.id,
        actorName: rider.displayName,
        groupIds: [group.id],
        refType: 'registration',
        refId: reg.id,
      });
      return reg;
    };
    await regA(riders.rider1, gA1, RegStatus.APPROVED, '自动审核通过', 'LOW', 'A001');
    await regA(riders.rider2, gA1, RegStatus.APPROVED, '自动审核通过', 'LOW', 'A002');
    await regA(riders.rider3, gA2, RegStatus.APPROVED, '自动审核通过', 'LOW', 'B001');
    await regA(riders.rider4, gA2, RegStatus.APPROVED, '自动审核通过（医疗风险 MEDIUM，符合大众组要求）', 'MEDIUM', 'B002');
    await regA(riders.rider6, gA3, RegStatus.APPROVED, '自动审核通过', 'LOW', 'C001');
    await regA(riders.rider5, gA4, RegStatus.APPROVED, '自动审核通过', 'LOW', 'D001');
    await regA(riders.rider7, gA1, RegStatus.REJECTED, '骑行经验 0 年不足组别要求的 3 年', 'LOW');
    await this.tl(raceA.id, TimelineType.RACE_STATUS, '赛事开放报名', { actorId: admin.id, actorName: admin.displayName });

    // ---------- 赛事 B：已归档（完整档案演示） ----------
    const raceB = await this.races.save(
      this.races.create({
        name: '2025 秋季环城挑战赛',
        description: '45km 山地环线，已完赛并归档。',
        raceDate: '2025-10-19',
        location: '老城体育场',
        status: RaceStatus.ARCHIVED,
      }),
    );
    const gB1 = await this.groups.save(this.groups.create({ raceId: raceB.id, name: '精英组', code: 'E', minAge: 18, maxAge: 40, allowedVehicleTypes: ['ROAD'], minExperienceYears: 3, capacity: 50, requiresInsurance: true, maxMedicalRisk: 'LOW', startTime: '08:00', sortOrder: 1 }));
    const gB2 = await this.groups.save(this.groups.create({ raceId: raceB.id, name: '大众组', code: 'F', minAge: 16, maxAge: 65, allowedVehicleTypes: ['ROAD', 'MOUNTAIN', 'GRAVEL'], minExperienceYears: 0, capacity: 200, requiresInsurance: true, maxMedicalRisk: 'MEDIUM', startTime: '08:30', sortOrder: 2 }));
    const gB3 = await this.groups.save(this.groups.create({ raceId: raceB.id, name: '女子组', code: 'G', minAge: 16, maxAge: 60, allowedVehicleTypes: ['ROAD', 'MOUNTAIN'], minExperienceYears: 0, capacity: 100, requiresInsurance: true, maxMedicalRisk: 'MEDIUM', startTime: '08:40', sortOrder: 3 }));

    const routeB = await this.routes.save(
      this.routes.create({ raceId: raceB.id, name: '山地环线 45km', distanceKm: 45, status: 'CONFIRMED', confirmedById: admin.id, confirmedAt: new Date('2025-10-10T10:00:00Z') }),
    );
    const ptsBDef = [
      { type: PointType.START, name: '起点·老城体育场', kmMark: 0, sequence: 1, trafficControlStart: '07:00', trafficControlEnd: '09:00' },
      { type: PointType.SUPPLY, name: '补给点1·河湾', kmMark: 12, sequence: 2, waterStock: 0, gelStock: 40, trafficControlStart: '07:30', trafficControlEnd: '10:30' },
      { type: PointType.CLIMB, name: '爬坡段·西岭', kmMark: 18, sequence: 3, description: '3.5km 坡度 7%' },
      { type: PointType.TIMING, name: '计时点·西岭顶', kmMark: 20, sequence: 4 },
      { type: PointType.MEDICAL, name: '医疗点·半山平台', kmMark: 25, sequence: 5 },
      { type: PointType.REPAIR, name: '维修点·谷口', kmMark: 30, sequence: 6, partsStock: 30 },
      { type: PointType.SUPPLY, name: '补给点2·竹林道', kmMark: 35, sequence: 7, waterStock: 120, gelStock: 80 },
      { type: PointType.FINISH, name: '终点·老城体育场', kmMark: 45, sequence: 8, trafficControlStart: '09:30', trafficControlEnd: '12:30' },
    ];
    const ptsB: RoutePoint[] = [];
    for (const p of ptsBDef) {
      ptsB.push(await this.points.save(this.points.create({ ...p, routeId: routeB.id } as Partial<RoutePoint>)));
    }
    const [pStart, pSup1, , pTiming, pMed, , pSup2, pFinish] = ptsB;

    // 报名 + 检录
    const mkReg = async (rider: User, group: RaceGroup, bib: string, risk = 'LOW') =>
      this.registrations.save(
        this.registrations.create({ raceId: raceB.id, groupId: group.id, riderId: rider.id, status: RegStatus.APPROVED, decisionReason: '自动审核通过', medicalRisk: risk, bibNumber: bib, chipId: `CHIP-${bib}` }),
      );
    const rb1 = await mkReg(riders.rider1, gB1, 'E001');
    const rb2 = await mkReg(riders.rider2, gB1, 'E002');
    const rb3 = await mkReg(riders.rider3, gB2, 'F001');
    const rb4 = await mkReg(riders.rider4, gB2, 'F002', 'MEDIUM');
    const rb6 = await mkReg(riders.rider6, gB3, 'G001');
    for (const reg of [rb1, rb2, rb3, rb4, rb6]) {
      await this.checkIns.save(
        this.checkIns.create({
          registrationId: reg.id,
          checkedById: checkin.id,
          idVerified: true,
          helmetOk: true,
          numberPlateOk: true,
          chipOk: true,
          brakesOk: true,
          insuranceOk: true,
          status: 'PASSED',
          notes: '',
        }),
      );
    }

    // 芯片与成绩（精英组 8:00 发车，大众组 8:30，女子组 8:40）
    const day = '2025-10-19';
    const chip = async (reg: Registration, point: RoutePoint, time: string) =>
      this.chips.save(this.chips.create({ raceId: raceB.id, registrationId: reg.id, routePointId: point.id, readAt: new Date(`${day}T${time}`), source: 'AUTO' }));
    const result = async (reg: Registration, group: RaceGroup, start: string, finish: string) => {
      const startedAt = new Date(`${day}T${start}`);
      const finishedAt = new Date(`${day}T${finish}`);
      await this.results.save(
        this.results.create({
          registrationId: reg.id,
          raceId: raceB.id,
          groupId: group.id,
          startedAt,
          finishedAt,
          netSeconds: Math.round((finishedAt.getTime() - startedAt.getTime()) / 1000),
          status: 'FINISHED',
        }),
      );
    };
    await chip(rb1, pStart, '08:00:05'); await chip(rb1, pTiming, '08:52:10'); await chip(rb1, pFinish, '09:38:22');
    await result(rb1, gB1, '08:00:05', '09:38:22');
    await chip(rb2, pStart, '08:00:06'); await chip(rb2, pTiming, '08:55:41'); await chip(rb2, pFinish, '09:44:03');
    await result(rb2, gB1, '08:00:06', '09:44:03');
    await chip(rb3, pStart, '08:30:04'); await chip(rb3, pTiming, '09:40:55'); await chip(rb3, pFinish, '10:41:37');
    await result(rb3, gB2, '08:30:04', '10:41:37');
    await chip(rb4, pStart, '08:30:08'); await chip(rb4, pFinish, '10:52:19'); // 计时点漏读 → 申诉
    await result(rb4, gB2, '08:30:08', '10:52:19');

    // 补给记录（补给点1 饮水发光 → 异常）
    const sup = async (point: RoutePoint, reg: Registration | null, water: number, gels: number, parts: number, time: string, note = '') =>
      this.supplyRecords.save(
        this.supplyRecords.create({ raceId: raceB.id, routePointId: point.id, registrationId: reg?.id || null, water, gels, repairParts: parts, note, recordedById: supply.id, passedAt: new Date(`${day}T${time}`) }),
      );
    await sup(pSup1, rb1, 1, 1, 0, '08:35:00');
    await sup(pSup1, rb2, 1, 0, 0, '08:38:00');
    await sup(pSup1, rb3, 2, 1, 0, '09:05:00');
    await sup(pSup1, rb4, 1, 1, 0, '09:08:00');
    await sup(pSup1, null, 0, 0, 0, '09:20:00', '饮水全部发放完毕，后续选手无饮水可取');
    await sup(pSup2, rb1, 0, 1, 0, '09:10:00');
    await sup(pSup2, rb3, 1, 0, 0, '10:05:00');

    // 退赛：陈静 30km 机械故障
    const wd: Withdrawal = await this.withdrawals.save(
      this.withdrawals.create({
        raceId: raceB.id,
        registrationId: rb6.id,
        routePointId: ptsB[5].id,
        kmMark: 30,
        reason: '后轮辐条断裂，无法继续骑行',
        needsShuttle: true,
        vehicleStatus: 'DAMAGED',
        reportedById: volunteer.id,
        reportedAt: new Date(`${day}T10:20:00`),
      }),
    );
    await this.results.save(this.results.create({ registrationId: rb6.id, raceId: raceB.id, groupId: gB3.id, status: 'DNF' }));

    // 医疗处置：王强摔车擦伤
    const med: MedicalRecord = await this.medicalRecords.save(
      this.medicalRecords.create({
        raceId: raceB.id,
        registrationId: rb3.id,
        routePointId: pMed.id,
        groupId: gB2.id,
        condition: '下坡过弯摔车，左肘擦伤',
        treatment: '清创包扎，观察 15 分钟后继续比赛',
        severity: 'MINOR',
        outcome: '继续参赛并完赛',
        handledById: medic.id,
        createdAt: new Date(`${day}T09:55:00`),
      }),
    );

    // 事件与通知
    const evWeather: RaceEvent = await this.events.save(
      this.events.create({
        raceId: raceB.id,
        type: EventType.WEATHER,
        severity: 'WARNING',
        title: '午后阵雨，西岭下坡路段湿滑',
        description: '气象预报 11:30 起有阵雨，西岭下坡段路面湿滑，请各岗位注意。',
        status: 'RESOLVED',
        createdById: admin.id,
        createdAt: new Date(`${day}T10:45:00`),
        resolvedAt: new Date(`${day}T12:00:00`),
      }),
    );
    const evChip: RaceEvent = await this.events.save(
      this.events.create({
        raceId: raceB.id,
        type: EventType.CHIP_MISREAD,
        severity: 'INFO',
        title: '计时点·西岭顶漏读号码 F002',
        description: '计时毯未读取到 F002 通过记录，终点裁判人工核对补录。',
        status: 'RESOLVED',
        createdById: referee.id,
        createdAt: new Date(`${day}T11:05:00`),
        resolvedAt: new Date(`${day}T11:40:00`),
      }),
    );
    for (const role of [Role.REFEREE, Role.MEDICAL, Role.SUPPLY, Role.VOLUNTEER]) {
      await this.notifications.save(this.notifications.create({ raceId: raceB.id, eventId: evWeather.id, targetRole: role, title: '[WEATHER] 午后阵雨，西岭下坡路段湿滑', message: '请各岗位注意雨天预案。', createdAt: new Date(`${day}T10:45:00`) }));
    }
    for (const role of [Role.REFEREE, Role.MEDICAL, Role.SUPPLY, Role.VOLUNTEER]) {
      await this.notifications.save(this.notifications.create({ raceId: raceB.id, eventId: evChip.id, targetRole: role, title: '[CHIP_MISREAD] 计时点·西岭顶漏读号码 F002', message: '请人工核对补录。', createdAt: new Date(`${day}T11:05:00`) }));
    }
    await this.notifications.save(this.notifications.create({ raceId: raceB.id, targetRole: Role.VOLUNTEER, targetGroupId: gB3.id, title: '退赛接驳请求', message: '号码 G001 在维修点·谷口退赛，需要接驳。', createdAt: new Date(`${day}T10:20:00`) }));

    // 申诉：赵敏就芯片漏读申诉成绩
    const appeal: Appeal = await this.appeals.save(
      this.appeals.create({
        raceId: raceB.id,
        registrationId: rb4.id,
        category: 'RESULT',
        reason: '计时点·西岭顶无我的通过记录，担心影响成绩有效性',
        evidence: '同组车手 F003 的骑行照片与码表轨迹截图（20.1km 处时间 09:41:02）',
        status: 'UPHELD',
        resolution: '裁判组核实芯片漏读属实，依据终点芯片与人工记录确认成绩有效，不影响排名。',
        handledById: referee.id,
        createdAt: new Date(`${day}T13:20:00`),
        resolvedAt: new Date(`${day}T15:02:00`),
      }),
    );

    // 时间轴（赛事 B 全天）
    const T = (t: string) => new Date(`${day}T${t}:00`);
    await this.tl(raceB.id, TimelineType.ROUTE_CONFIRMED, '路线「山地环线 45km」已确认（45km，8 个点位）', { actorId: admin.id, actorName: admin.displayName, createdAt: new Date('2025-10-10T10:00:00Z') });
    await this.tl(raceB.id, TimelineType.RACE_STATUS, '赛事状态变更为 RACE_DAY', { actorId: admin.id, actorName: admin.displayName, createdAt: T('06:30') });
    await this.tl(raceB.id, TimelineType.CHECKIN, '检录通过：号码 E001（精英组）', { actorId: checkin.id, actorName: checkin.displayName, groupIds: [gB1.id], createdAt: T('07:12') });
    await this.tl(raceB.id, TimelineType.CHECKIN, '检录通过：号码 E002（精英组）', { actorId: checkin.id, actorName: checkin.displayName, groupIds: [gB1.id], createdAt: T('07:15') });
    await this.tl(raceB.id, TimelineType.CHECKIN, '检录通过：号码 F001（大众组）', { actorId: checkin.id, actorName: checkin.displayName, groupIds: [gB2.id], createdAt: T('07:40') });
    await this.tl(raceB.id, TimelineType.CHECKIN, '检录通过：号码 F002（大众组）', { actorId: checkin.id, actorName: checkin.displayName, groupIds: [gB2.id], createdAt: T('07:44') });
    await this.tl(raceB.id, TimelineType.CHECKIN, '检录通过：号码 G001（女子组）', { actorId: checkin.id, actorName: checkin.displayName, groupIds: [gB3.id], createdAt: T('07:50') });
    await this.tl(raceB.id, TimelineType.REFEREE_INSTRUCTION, '裁判指令：精英组 08:00 准时发车，大众组 08:30，女子组 08:40（影响组别：精英组、大众组、女子组）', { actorId: referee.id, actorName: referee.displayName, groupIds: [gB1.id, gB2.id, gB3.id], createdAt: T('07:55') });
    await this.tl(raceB.id, TimelineType.MEDICAL, '医疗处置（号码 F001） @医疗点·半山平台：下坡过弯摔车，左肘擦伤 → 清创包扎，观察 15 分钟后继续比赛', { actorId: medic.id, actorName: medic.displayName, groupIds: [gB2.id], refType: 'medical', refId: med.id, createdAt: T('09:55') });
    await this.tl(raceB.id, TimelineType.SUPPLY_ANOMALY, '补给异常 @补给点1·河湾：饮水库存不足（需 1，余 0）', { actorId: supply.id, actorName: supply.displayName, createdAt: T('09:20') });
    await this.tl(raceB.id, TimelineType.WITHDRAWAL, '退赛登记：号码 G001（女子组）于维修点·谷口退赛，原因：后轮辐条断裂，无法继续骑行；接驳：需要；车辆：DAMAGED', { actorId: volunteer.id, actorName: volunteer.displayName, groupIds: [gB3.id], refType: 'withdrawal', refId: wd.id, createdAt: T('10:20') });
    await this.tl(raceB.id, TimelineType.EVENT, '赛道事件[WEATHER] 午后阵雨，西岭下坡路段湿滑 → 已通知 REFEREE/MEDICAL/SUPPLY/VOLUNTEER', { actorId: admin.id, actorName: admin.displayName, refType: 'event', refId: evWeather.id, createdAt: T('10:45') });
    await this.tl(raceB.id, TimelineType.REFEREE_INSTRUCTION, '裁判指令：因降雨，西岭下坡段限速 30km/h，禁止超车（影响组别：精英组、大众组）', { actorId: referee.id, actorName: referee.displayName, groupIds: [gB1.id, gB2.id], createdAt: T('10:50') });
    await this.tl(raceB.id, TimelineType.RIDER_NOTIFICATION, '选手通知：雨天路滑，下坡控速，补给点2 增设热饮（影响组别：全部）', { actorId: admin.id, actorName: admin.displayName, createdAt: T('10:52') });
    await this.tl(raceB.id, TimelineType.EVENT, '赛道事件[CHIP_MISREAD] 计时点·西岭顶漏读号码 F002 → 已通知 REFEREE/MEDICAL/SUPPLY/VOLUNTEER', { actorId: referee.id, actorName: referee.displayName, groupIds: [gB2.id], refType: 'event', refId: evChip.id, createdAt: T('11:05') });
    await this.tl(raceB.id, TimelineType.RESULT, '成绩产生：号码 E001 净成绩 1:38:17', { actorId: referee.id, actorName: referee.displayName, groupIds: [gB1.id], createdAt: T('09:40') });
    await this.tl(raceB.id, TimelineType.RESULT, '成绩产生：号码 E002 净成绩 1:43:57', { actorId: referee.id, actorName: referee.displayName, groupIds: [gB1.id], createdAt: T('09:46') });
    await this.tl(raceB.id, TimelineType.RESULT, '成绩产生：号码 F001 净成绩 2:11:33', { actorId: referee.id, actorName: referee.displayName, groupIds: [gB2.id], createdAt: T('10:43') });
    await this.tl(raceB.id, TimelineType.RESULT, '成绩产生：号码 F002 净成绩 2:22:11', { actorId: referee.id, actorName: referee.displayName, groupIds: [gB2.id], createdAt: T('10:54') });
    await this.tl(raceB.id, TimelineType.APPEAL, '申诉提交：号码 F002 就「RESULT」提出申诉：计时点·西岭顶无我的通过记录，担心影响成绩有效性', { actorId: riders.rider4.id, actorName: riders.rider4.displayName, groupIds: [gB2.id], refType: 'appeal', refId: appeal.id, createdAt: T('13:20') });
    await this.tl(raceB.id, TimelineType.APPEAL, '申诉处理：号码 F002 的申诉 → UPHELD（裁判组核实芯片漏读属实，依据终点芯片与人工记录确认成绩有效，不影响排名。）', { actorId: referee.id, actorName: referee.displayName, groupIds: [gB2.id], refType: 'appeal', refId: appeal.id, createdAt: T('15:02') });
    await this.tl(raceB.id, TimelineType.RACE_STATUS, '赛事状态变更为 FINISHED', { actorId: admin.id, actorName: admin.displayName, createdAt: T('13:00') });
    await this.tl(raceB.id, TimelineType.RACE_STATUS, '赛事状态变更为 ARCHIVED：成绩、芯片记录、补给异常、医疗处置与申诉证据已归档', { actorId: admin.id, actorName: admin.displayName, createdAt: T('18:00') });
  }
}
