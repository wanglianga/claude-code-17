'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { RESULT_STATUS, fmtSeconds } from '@/lib/labels';
import { Badge } from './ui';
import { ResultRuleBadge } from './ShorteningBanner';

export default function ResultsView({ raceId }: { raceId: string }) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api(`results/race/${raceId}`)
      .then(setData)
      .finally(() => setLoading(false));
  }, [raceId]);

  if (loading) return <div className="muted">加载中…</div>;
  // 兼容旧返回（数组）与新返回（{ groups, shortening }）
  const groups: any[] = Array.isArray(data) ? data : data?.groups || [];
  const shortening = Array.isArray(data) ? null : data?.shortening;
  if (!groups.length) return <div className="muted">暂无成绩</div>;

  return (
    <div>
      {shortening && (
        <div className="alert error" style={{ marginBottom: 12 }}>
          🌩 本场比赛因天气缩短赛段：新终点「{shortening.junction?.name}」（{shortening.junction?.kmMark}km）。
          已过关键路口者按过点时间单独排名，未通过者关门前到达按关门点成绩计，超时记 DNF。
        </div>
      )}
      {groups.map(({ group, finished, others }) => (
        <div key={group.id} style={{ marginBottom: 22 }}>
          <h3>
            {group.name} <span className="muted small">发车 {group.startTime || '-'}</span>
          </h3>
          {finished.length === 0 && others.length === 0 ? (
            <div className="muted small">暂无成绩</div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th style={{ width: 60 }}>名次</th>
                  <th>号码</th>
                  <th>选手</th>
                  <th>净成绩</th>
                  <th>成绩规则</th>
                  <th>状态</th>
                </tr>
              </thead>
              <tbody>
                {finished.map((r) => (
                  <tr key={r.id}>
                    <td className={r.rank <= 3 ? `rank-${r.rank}` : ''}>
                      {r.rank <= 3 ? ['🥇', '🥈', '🥉'][r.rank - 1] : ''} {r.rank}
                    </td>
                    <td>{r.bibNumber}</td>
                    <td>{r.riderName}</td>
                    <td>{fmtSeconds(r.netSeconds)}</td>
                    <td><ResultRuleBadge rule={r.resultRule} /></td>
                    <td>
                      <Badge color={RESULT_STATUS[r.status]?.[1] || 'gray'}>{RESULT_STATUS[r.status]?.[0] || r.status}</Badge>
                    </td>
                  </tr>
                ))}
                {others.map((r) => (
                  <tr key={r.id}>
                    <td>-</td>
                    <td>{r.bibNumber}</td>
                    <td>{r.riderName}</td>
                    <td>-</td>
                    <td><ResultRuleBadge rule={r.resultRule} /></td>
                    <td>
                      <Badge color={RESULT_STATUS[r.status]?.[1] || 'gray'}>{RESULT_STATUS[r.status]?.[0] || r.status}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      ))}
    </div>
  );
}
