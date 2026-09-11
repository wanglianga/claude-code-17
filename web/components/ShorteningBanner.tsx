'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Badge } from './ui';
import { RESULT_RULES, SHORTENING_STATUS, WEATHER_KINDS, fmtTime } from '@/lib/labels';

/** 赛段缩短横幅：补给点/计时点/志愿者/医疗页面顶部显示新终点与新关门时间 */
export function ShorteningBanner({ raceId }: { raceId: string }) {
  const [list, setList] = useState<any[]>([]);
  useEffect(() => {
    if (!raceId) return;
    api(`shortenings/race/${raceId}`).then(setList).catch(() => {});
  }, [raceId]);
  if (!list.length) return null;
  const latest = list[0];
  if (!['PROPOSED', 'CONFIRMED'].includes(latest.status)) return null;
  return (
    <div className={`alert ${latest.status === 'CONFIRMED' ? 'error' : 'info'}`} style={{ marginBottom: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <strong>
          {latest.status === 'CONFIRMED' ? '🌩 赛段缩短已确认生效' : '🌦 赛段缩短方案待裁判确认'}
        </strong>
        <Badge color={SHORTENING_STATUS[latest.status]?.[1]}>{SHORTENING_STATUS[latest.status]?.[0]}</Badge>
        {latest.alert && <span className="small">{WEATHER_KINDS[latest.alert.kind] || latest.alert.kind} · {latest.alert.title}</span>}
      </div>
      <div className="small" style={{ marginTop: 6 }}>
        新终点/关键路口：<strong>{latest.junction?.name}</strong>（{latest.junction?.kmMark}km）
        {latest.confirmedAt && <> · 确认时间 {fmtTime(latest.confirmedAt)}</>}
      </div>
      <div className="small" style={{ marginTop: 4 }}>
        各组新关门时间：
        {latest.cutoffPlan.map((p: any) => (
          <span key={p.groupId} style={{ marginRight: 14 }}>
            {p.groupName} <strong style={{ color: '#b00' }}>{p.cutoffTime}</strong>
            <span className="muted">（已过路口 {p.ridersAhead} 人 / 未过 {p.ridersBehind} 人）</span>
          </span>
        ))}
      </div>
      {latest.status === 'PROPOSED' && <div className="small muted" style={{ marginTop: 4 }}>请等待裁判确认；确认后本岗位需签收新关门时间并按新任务单执行。</div>}
    </div>
  );
}

/** 成绩规则徽标（成绩榜/成绩页复用） */
export function ResultRuleBadge({ rule }: { rule: string }) {
  if (!rule || rule === 'NORMAL') return null;
  const [label, color] = RESULT_RULES[rule] || [rule, 'gray'];
  return <Badge color={color}>{label}</Badge>;
}
