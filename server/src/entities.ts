import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';

// ---------------- 枚举 ----------------

export enum Role {
  RIDER = 'RIDER', // 选手
  OPS = 'OPS', // 赛事运营
  CHECKIN = 'CHECKIN', // 检录工作人员
  SUPPLY = 'SUPPLY', // 补给点工作人员
  REFEREE = 'REFEREE', // 裁判
  MEDICAL = 'MEDICAL', // 医疗
  VOLUNTEER = 'VOLUNTEER', // 志愿者
}

export enum RaceStatus {
  DRAFT = 'DRAFT', // 草稿
  REGISTRATION_OPEN = 'REGISTRATION_OPEN', // 报名中
  REGISTRATION_CLOSED = 'REGISTRATION_CLOSED', // 报名截止
  RACE_DAY = 'RACE_DAY', // 比赛日
  FINISHED = 'FINISHED', // 已完赛
  ARCHIVED = 'ARCHIVED', // 已归档
}

export enum RegStatus {
  PENDING = 'PENDING_REVIEW', // 待审核
  APPROVED = 'APPROVED', // 已通过
  REJECTED = 'REJECTED', // 已拒绝
  WAITLISTED = 'WAITLISTED', // 候补中
  CANCELLED = 'CANCELLED', // 已取消
}

export enum PointType {
  START = 'START', // 起点
  FINISH = 'FINISH', // 终点
  CLIMB = 'CLIMB', // 爬坡段
  SUPPLY = 'SUPPLY', // 补给点
  REPAIR = 'REPAIR', // 维修点
  MEDICAL = 'MEDICAL', // 医疗点
  TIMING = 'TIMING', // 计时点
  TRAFFIC_CONTROL = 'TRAFFIC_CONTROL', // 交通管制点
}

export enum EventType {
  GROUP_STUCK = 'GROUP_STUCK', // 某组选手大量滞留
  WEATHER = 'WEATHER', // 天气突变
  CRASH = 'CRASH', // 摔车
  CHIP_MISREAD = 'CHIP_MISREAD', // 芯片漏读
  TRAFFIC_LIFTED = 'TRAFFIC_LIFTED', // 交通管制提前解除
  OTHER = 'OTHER',
}

export enum TimelineType {
  RACE_STATUS = 'RACE_STATUS', // 赛事状态变更
  REGISTRATION = 'REGISTRATION', // 报名/审核
  ROUTE_CONFIRMED = 'ROUTE_CONFIRMED', // 路线确认
  CHECKIN = 'CHECKIN', // 检录
  EVENT = 'EVENT', // 赛道事件
  REFEREE_INSTRUCTION = 'REFEREE_INSTRUCTION', // 裁判指令
  RIDER_NOTIFICATION = 'RIDER_NOTIFICATION', // 选手通知
  MEDICAL = 'MEDICAL', // 医疗处置
  WITHDRAWAL = 'WITHDRAWAL', // 退赛
  SUPPLY_ANOMALY = 'SUPPLY_ANOMALY', // 补给异常
  RESULT = 'RESULT', // 成绩
  APPEAL = 'APPEAL', // 申诉
  STAGE_SHORTENING = 'STAGE_SHORTENING', // 天气突变·赛段缩短
}

// ---------------- 实体 ----------------

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  username: string;

  @Column()
  passwordHash: string;

  @Column()
  displayName: string;

  @Column({ type: 'varchar', length: 20 })
  role: Role;

  @CreateDateColumn()
  createdAt: Date;
}

@Entity('rider_profiles')
export class RiderProfile {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  userId: string;

  @Column()
  fullName: string;

  @Column({ default: 'M' })
  gender: string; // M/F

  @Column()
  birthDate: string; // yyyy-mm-dd

  @Column()
  idType: string; // 身份证/护照

  @Column()
  idNumber: string;

  @Column({ default: '' })
  phone: string;

  @Column({ type: 'int', default: 0 })
  experienceYears: number; // 骑行经验（年）

  @Column()
  vehicleType: string; // ROAD/MOUNTAIN/GRAVEL/FOLDING

  @Column()
  emergencyContactName: string;

  @Column()
  emergencyContactPhone: string;

  @Column({ default: false })
  healthCommitment: boolean; // 健康承诺

  @Column({ type: 'text', default: '' })
  healthConditions: string; // 既往病史/健康申报

  @Column({ type: 'text', default: '' })
  historicalResults: string; // 历史成绩

  @Column({ default: '' })
  insuranceProvider: string;

  @Column({ default: '' })
  insurancePolicyNo: string;

  @Column({ default: '' })
  insuranceValidUntil: string; // yyyy-mm-dd
}

@Entity('races')
export class Race {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ type: 'text', default: '' })
  description: string;

  @Column()
  raceDate: string; // yyyy-mm-dd

  @Column({ default: '' })
  location: string;

  @Column({ type: 'varchar', length: 30, default: RaceStatus.DRAFT })
  status: RaceStatus;

  @CreateDateColumn()
  createdAt: Date;
}

@Entity('race_groups')
export class RaceGroup {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  raceId: string;

  @Column()
  name: string;

  @Column()
  code: string; // 号码牌前缀，如 A/B/C

  @Column({ type: 'int', default: 16 })
  minAge: number;

  @Column({ type: 'int', default: 65 })
  maxAge: number;

  @Column({ type: 'simple-array' })
  allowedVehicleTypes: string[];

  @Column({ type: 'int', default: 0 })
  minExperienceYears: number;

  @Column({ type: 'int', default: 100 })
  capacity: number; // 人数上限

  @Column({ default: true })
  requiresInsurance: boolean; // 保险要求

  @Column({ type: 'varchar', length: 10, default: 'MEDIUM' })
  maxMedicalRisk: string; // 允许的最高医疗风险 LOW/MEDIUM/HIGH

  @Column({ default: '' })
  startTime: string; // 发车时间 "08:00"

  @Column({ type: 'int', default: 0 })
  sortOrder: number;
}

@Entity('registrations')
@Unique(['raceId', 'riderId'])
export class Registration {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  raceId: string;

  @Column()
  groupId: string;

  @Column()
  riderId: string;

  @Column({ type: 'varchar', length: 20, default: RegStatus.PENDING })
  status: RegStatus;

  @Column({ type: 'text', default: '' })
  decisionReason: string; // 系统自动判定原因

  @Column({ type: 'varchar', length: 10, default: 'LOW' })
  medicalRisk: string; // 评估出的医疗风险

  @Column({ default: '' })
  bibNumber: string; // 号码牌

  @Column({ default: '' })
  chipId: string; // 计时芯片

  @Column({ type: 'text', default: '' })
  reviewNote: string; // 人工审核备注

  @Column({ nullable: true })
  reviewedById: string;

  @Column({ type: 'timestamptz', nullable: true })
  reviewedAt: Date;

  @CreateDateColumn()
  submittedAt: Date;
}

@Entity('routes')
export class RaceRoute {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  raceId: string;

  @Column()
  name: string;

  @Column({ type: 'float', default: 0 })
  distanceKm: number;

  @Column({ type: 'varchar', length: 10, default: 'DRAFT' })
  status: string; // DRAFT/CONFIRMED

  @Column({ type: 'text', default: '' })
  notes: string;

  @Column({ nullable: true })
  confirmedById: string;

  @Column({ type: 'timestamptz', nullable: true })
  confirmedAt: Date;
}

@Entity('route_points')
export class RoutePoint {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  routeId: string;

  @Column({ type: 'varchar', length: 20 })
  type: PointType;

  @Column()
  name: string;

  @Column({ type: 'float', default: 0 })
  kmMark: number;

  @Column({ type: 'int', default: 0 })
  sequence: number;

  @Column({ type: 'text', default: '' })
  description: string;

  @Column({ default: '' })
  trafficControlStart: string; // 交通管制开始 "07:30"

  @Column({ default: '' })
  trafficControlEnd: string; // 交通管制结束 "11:00"

  @Column({ type: 'int', default: 0 })
  waterStock: number; // 饮水库存

  @Column({ type: 'int', default: 0 })
  gelStock: number; // 能量胶库存

  @Column({ type: 'int', default: 0 })
  partsStock: number; // 维修配件库存

  @Column({ type: 'int', default: 0 })
  medicalCapacity: number; // 医疗点容量（可同时容纳/处置人数，0=非医疗点或不限）

  @Column({ default: '' })
  cutoffTime: string; // 当前关门时间 "HH:mm"，赛段缩短后会被更新（空=无关门限制）

  @Column({ default: true })
  isActive: boolean; // 赛段缩短后，撤销路段上的点位置为 false（岗位/任务不再生效）

  @Column({ default: true })
  staffed: boolean; // 该点位比赛日是否有岗位人员在岗（false=无人值守，缩短通知无法签收）
}

// 点位 <-> 组别 关联（空 = 适用于全部组别）
@Entity('route_point_groups')
@Unique(['routePointId', 'groupId'])
export class RoutePointGroup {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  routePointId: string;

  @Column()
  groupId: string;
}

@Entity('check_ins')
export class CheckIn {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  registrationId: string;

  @Column()
  checkedById: string;

  @Column({ default: false })
  idVerified: boolean; // 证件

  @Column({ default: false })
  helmetOk: boolean; // 头盔

  @Column({ default: false })
  numberPlateOk: boolean; // 号码牌

  @Column({ default: false })
  chipOk: boolean; // 芯片

  @Column({ default: false })
  brakesOk: boolean; // 车辆刹车

  @Column({ default: false })
  insuranceOk: boolean; // 保险

  @Column({ type: 'varchar', length: 10 })
  status: string; // PASSED/FAILED

  @Column({ type: 'text', default: '' })
  notes: string;

  @CreateDateColumn()
  checkedAt: Date;
}

@Entity('supply_records')
export class SupplyRecord {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  raceId: string;

  @Column()
  routePointId: string;

  @Column({ nullable: true })
  registrationId: string; // 通过的选手（可为空=仅登记物资）

  @Column({ type: 'int', default: 0 })
  water: number; // 饮水（瓶）

  @Column({ type: 'int', default: 0 })
  gels: number; // 能量胶（支）

  @Column({ type: 'int', default: 0 })
  repairParts: number; // 维修配件（件）

  @Column({ type: 'text', default: '' })
  note: string;

  @Column()
  recordedById: string;

  @CreateDateColumn()
  passedAt: Date;
}

@Entity('race_events')
export class RaceEvent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  raceId: string;

  @Column({ type: 'varchar', length: 20 })
  type: EventType;

  @Column({ type: 'varchar', length: 10, default: 'WARNING' })
  severity: string; // INFO/WARNING/CRITICAL

  @Column()
  title: string;

  @Column({ type: 'text', default: '' })
  description: string;

  @Column({ nullable: true })
  groupId: string; // 受影响组别

  @Column({ nullable: true })
  routePointId: string;

  @Column({ type: 'varchar', length: 15, default: 'OPEN' })
  status: string; // OPEN/ACKNOWLEDGED/RESOLVED

  @Column()
  createdById: string;

  @CreateDateColumn()
  createdAt: Date;

  @Column({ type: 'timestamptz', nullable: true })
  resolvedAt: Date;
}

@Entity('notifications')
export class Notification {
  @PrimaryGeneratedColumn('increment')
  id: number;

  @Column()
  raceId: string;

  @Column({ nullable: true })
  eventId: string;

  @Column({ type: 'varchar', length: 15 })
  targetRole: Role; // 接收角色（含 RIDER=选手通知）

  @Column({ nullable: true })
  targetGroupId: string; // 限定组别（空=全部）

  @Column()
  title: string;

  @Column({ type: 'text', default: '' })
  message: string;

  @CreateDateColumn()
  createdAt: Date;
}

@Entity('withdrawals')
export class Withdrawal {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  raceId: string;

  @Column()
  registrationId: string;

  @Column({ nullable: true })
  routePointId: string; // 退赛位置（点位）

  @Column({ type: 'float', nullable: true })
  kmMark: number; // 或公里数

  @Column({ type: 'text' })
  reason: string;

  @Column({ default: false })
  needsShuttle: boolean; // 是否需要接驳

  @Column({ type: 'varchar', length: 20, default: 'OK' })
  vehicleStatus: string; // OK/DAMAGED/LEFT_ON_SITE

  @Column()
  reportedById: string;

  @CreateDateColumn()
  reportedAt: Date;
}

@Entity('chip_records')
export class ChipRecord {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  raceId: string;

  @Column()
  registrationId: string;

  @Column()
  routePointId: string; // 计时点位

  @Column({ type: 'timestamptz' })
  readAt: Date;

  @Column({ type: 'varchar', length: 10, default: 'MANUAL' })
  source: string; // MANUAL/AUTO

  @Column({ nullable: true })
  createdById: string;

  @CreateDateColumn()
  createdAt: Date;
}

@Entity('results')
export class RaceResult {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  registrationId: string;

  @Column()
  raceId: string;

  @Column()
  groupId: string;

  @Column({ type: 'timestamptz', nullable: true })
  startedAt: Date;

  @Column({ type: 'timestamptz', nullable: true })
  finishedAt: Date;

  @Column({ type: 'int', nullable: true })
  netSeconds: number; // 净成绩（秒）

  @Column({ type: 'varchar', length: 10, default: 'FINISHED' })
  status: string; // FINISHED/DNF/DSQ

  @Column({ type: 'varchar', length: 20, default: 'NORMAL' })
  resultRule: string; // 成绩记录规则：NORMAL/BEHIND_CUTOFF/PASSED_JUNCTION（赛段缩短时区分关键路口前后）

  @Column({ nullable: true })
  shorteningId: string; // 由哪次赛段缩短决定产生

  @Column({ type: 'timestamptz', nullable: true })
  junctionPassedAt: Date; // 缩短决定生效时，通过关键路口的过点时间（用于 PASSED_JUNCTION 排名）

  @CreateDateColumn()
  createdAt: Date;
}

// ---------------- 天气突变 · 赛段缩短 ----------------

@Entity('weather_alerts')
export class WeatherAlert {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  raceId: string;

  @Column({ type: 'varchar', length: 15 })
  kind: string; // WIND 大风 / RAIN 暴雨 / HEAT 高温

  @Column({ type: 'varchar', length: 10, default: 'WARNING' })
  severity: string; // INFO/WARNING/CRITICAL

  @Column()
  title: string;

  @Column({ type: 'text', default: '' })
  description: string;

  @Column()
  issuedAt: string; // 预警发布时间 "HH:mm"

  @Column()
  effectiveUntil: string; // 预警预计解除 "HH:mm"

  @Column({ type: 'float', nullable: true })
  affectedFromKm: number; // 受影响赛段起（公里标，空=全程）

  @Column({ type: 'float', nullable: true })
  affectedToKm: number; // 受影响赛段止

  @Column({ type: 'simple-array', nullable: true })
  groupIds: string[]; // 受影响组别（空=全部）

  @Column({ nullable: true })
  eventId: string; // 关联的赛道事件（可选）

  @Column()
  createdById: string;

  @CreateDateColumn()
  createdAt: Date;
}

@Entity('stage_shortenings')
export class StageShortening {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  raceId: string;

  @Column()
  alertId: string;

  // 新终点（关键路口/计时点）
  @Column()
  newFinishPointId: string;

  // 各组别新关门时间：JSON 字符串 [{groupId, groupName, cutoffTime, ridersAhead, ridersBehind}]
  @Column({ type: 'text' })
  cutoffPlanJson: string;

  @Column({ type: 'varchar', length: 15, default: 'PROPOSED' })
  status: string; // PROPOSED 待裁判确认 / CONFIRMED 已确认 / CANCELLED

  @Column({ type: 'simple-array', nullable: true })
  groupIds: string[]; // 适用组别（空=全部）

  @Column({ type: 'text', default: '' })
  assessmentSummary: string; // 评估依据摘要（位置/补给/医疗/管制）

  @Column({ nullable: true })
  proposedById: string;

  @Column({ type: 'timestamptz', nullable: true })
  proposedAt: Date;

  @Column({ nullable: true })
  confirmedById: string;

  @Column({ type: 'timestamptz', nullable: true })
  confirmedAt: Date;

  // 通知与签收
  @Column({ type: 'simple-array', nullable: true })
  notifiedPostIds: string[]; // 应通知岗位（点位 id，含补给/计时/医疗/志愿者站位）

  @Column({ type: 'simple-array', nullable: true })
  acknowledgedPostIds: string[]; // 已签收岗位

  @Column({ type: 'simple-array', nullable: true })
  taskIds: string[]; // 重生成的任务

  @CreateDateColumn()
  createdAt: Date;
}

@Entity('shortening_tasks')
export class ShorteningTask {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  raceId: string;

  @Column()
  shorteningId: string;

  @Column({ type: 'varchar', length: 15 })
  kind: string; // SUPPLY 补给物资 / SHUTTLE 接驳车辆 / STATION 志愿者站位

  @Column({ type: 'varchar', length: 15 })
  targetRole: Role; // SUPPLY/VOLUNTEER

  @Column({ nullable: true })
  routePointId: string; // 关联点位（新终点/补给点）

  @Column()
  title: string;

  @Column({ type: 'text', default: '' })
  detail: string;

  @Column({ type: 'varchar', length: 15, default: 'PENDING' })
  status: string; // PENDING 待处理 / DONE 已完成 / UNNOTIFIED 未接到通知（岗位缺失标记）

  @Column({ default: false })
  unnotified: boolean; // 该岗位未接到通知（无在岗人员/未签收）

  @Column({ nullable: true })
  completedById: string;

  @Column({ type: 'timestamptz', nullable: true })
  completedAt: Date;

  @CreateDateColumn()
  createdAt: Date;
}

@Entity('medical_records')
export class MedicalRecord {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  raceId: string;

  @Column({ nullable: true })
  registrationId: string;

  @Column({ nullable: true })
  routePointId: string;

  @Column({ nullable: true })
  groupId: string;

  @Column()
  condition: string; // 伤情/病情

  @Column({ type: 'text', default: '' })
  treatment: string; // 处置

  @Column({ type: 'varchar', length: 10, default: 'MINOR' })
  severity: string; // MINOR/MODERATE/SEVERE

  @Column({ type: 'text', default: '' })
  outcome: string; // 转归

  @Column()
  handledById: string;

  @CreateDateColumn()
  createdAt: Date;
}

@Entity('appeals')
export class Appeal {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  raceId: string;

  @Column()
  registrationId: string;

  @Column({ type: 'varchar', length: 15, default: 'RESULT' })
  category: string; // RESULT/PENALTY/SAFETY/OTHER

  @Column({ type: 'text' })
  reason: string;

  @Column({ type: 'text', default: '' })
  evidence: string; // 申诉证据

  @Column({ type: 'varchar', length: 15, default: 'SUBMITTED' })
  status: string; // SUBMITTED/UNDER_REVIEW/UPHELD/REJECTED

  @Column({ type: 'text', default: '' })
  resolution: string;

  @Column({ nullable: true })
  handledById: string;

  @CreateDateColumn()
  createdAt: Date;

  @Column({ type: 'timestamptz', nullable: true })
  resolvedAt: Date;
}

@Entity('timeline_entries')
export class TimelineEntry {
  @PrimaryGeneratedColumn('increment')
  id: number;

  @Index()
  @Column()
  raceId: string;

  @Column({ type: 'varchar', length: 25 })
  type: TimelineType;

  @Column({ nullable: true })
  actorId: string;

  @Column({ default: '' })
  actorName: string;

  @Column({ type: 'text' })
  message: string;

  @Column({ type: 'simple-array', nullable: true })
  affectedGroupIds: string[]; // 该决定/事件影响的组别

  @Column({ type: 'varchar', length: 20, nullable: true })
  refType: string;

  @Column({ nullable: true })
  refId: string;

  @CreateDateColumn()
  createdAt: Date;
}

export const ALL_ENTITIES = [
  User,
  RiderProfile,
  Race,
  RaceGroup,
  Registration,
  RaceRoute,
  RoutePoint,
  RoutePointGroup,
  CheckIn,
  SupplyRecord,
  RaceEvent,
  Notification,
  Withdrawal,
  ChipRecord,
  RaceResult,
  MedicalRecord,
  Appeal,
  TimelineEntry,
  WeatherAlert,
  StageShortening,
  ShorteningTask,
];
