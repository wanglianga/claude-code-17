'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { RESULT_STATUS, fmtSeconds } from '@/lib/labels';
import { Badge } from './ui';

export default function ResultsView({ raceId }: { raceId: string }) {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api(`results/race/${raceId}`)
      .then(setData)
      .finally(() => setLoading(false));
  }, [raceId]);

  if (loading) return <div className="muted">加载中…</div>;
  if (!data.length) return <div className="muted">暂无成绩</div>;

  return (
    <div>
      {data.map(({ group, finished, others }) => (
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
