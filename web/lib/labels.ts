export const ROLE_LABELS: Record<string, string> = {
  RIDER: '选手',
  OPS: '赛事运营',
  CHECKIN: '检录员',
  SUPPLY: '补给员',
  REFEREE: '裁判',
  MEDICAL: '医疗',
  VOLUNTEER: '志愿者',
};

export const RACE_STATUS: Record<string, [string, string]> = {
  DRAFT: ['草稿', 'gray'],
  REGISTRATION_OPEN: ['报名中', 'green'],
  REGISTRATION_CLOSED: ['报名截止', 'orange'],
  RACE_DAY: ['比赛日', 'blue'],
  FINISHED: ['已完赛', 'purple'],
  ARCHIVED: ['已归档', 'dark'],
};

export const REG_STATUS: Record<string, [string, string]> = {
  PENDING_REVIEW: ['待审核', 'orange'],
  APPROVED: ['已通过', 'green'],
  REJECTED: ['已拒绝', 'red'],
  WAITLISTED: ['候补中', 'blue'],
  CANCELLED: ['已取消', 'gray'],
};

export const POINT_TYPES: Record<string, string> = {
  START: '起点',
  FINISH: '终点',
  CLIMB: '爬坡段',
  SUPPLY: '补给点',
  REPAIR: '维修点',
  MEDICAL: '医疗点',
  TIMING: '计时点',
  TRAFFIC_CONTROL: '交通管制',
};

export const EVENT_TYPES: Record<string, string> = {
  GROUP_STUCK: '选手大量滞留',
  WEATHER: '天气突变',
  CRASH: '摔车事故',
  CHIP_MISREAD: '芯片漏读',
  TRAFFIC_LIFTED: '交通管制提前解除',
  OTHER: '其他',
};

export const TIMELINE_TYPES: Record<string, [string, string]> = {
  RACE_STATUS: ['赛事状态', 'dark'],
  REGISTRATION: ['报名', 'blue'],
  ROUTE_CONFIRMED: ['路线确认', 'purple'],
  CHECKIN: ['检录', 'green'],
  EVENT: ['赛道事件', 'red'],
  REFEREE_INSTRUCTION: ['裁判指令', 'orange'],
  RIDER_NOTIFICATION: ['选手通知', 'blue'],
  MEDICAL: ['医疗处置', 'red'],
  WITHDRAWAL: ['退赛', 'orange'],
  SUPPLY_ANOMALY: ['补给异常', 'red'],
  RESULT: ['成绩', 'green'],
  APPEAL: ['申诉', 'purple'],
};

export const VEHICLE_TYPES: Record<string, string> = {
  ROAD: '公路车',
  MOUNTAIN: '山地车',
  GRAVEL: 'Gravel',
  FOLDING: '折叠车',
};

export const RISK_LABELS: Record<string, [string, string]> = {
  LOW: ['低', 'green'],
  MEDIUM: ['中', 'orange'],
  HIGH: ['高', 'red'],
};

export const SEVERITY: Record<string, [string, string]> = {
  INFO: ['提示', 'blue'],
  WARNING: ['警告', 'orange'],
  CRITICAL: ['严重', 'red'],
};

export const EVENT_STATUS: Record<string, [string, string]> = {
  OPEN: ['待处理', 'red'],
  ACKNOWLEDGED: ['已知晓', 'orange'],
  RESOLVED: ['已解决', 'green'],
};

export const APPEAL_STATUS: Record<string, [string, string]> = {
  SUBMITTED: ['已提交', 'blue'],
  UNDER_REVIEW: ['复核中', 'orange'],
  UPHELD: ['申诉成立', 'green'],
  REJECTED: ['申诉驳回', 'red'],
};

export const RESULT_STATUS: Record<string, [string, string]> = {
  FINISHED: ['完赛', 'green'],
  DNF: ['未完赛', 'orange'],
  DSQ: ['取消资格', 'red'],
};

export function fmtSeconds(sec: number | null | undefined): string {
  if (sec == null) return '-';
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function fmtTime(t: string | Date | null | undefined): string {
  if (!t) return '-';
  const d = new Date(t);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
