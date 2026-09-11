'use client';

import { useEffect, useState } from 'react';
import Nav from '@/components/Nav';
import { Badge, ErrorBox, useRequireRole } from '@/components/ui';
import { api } from '@/lib/api';
import { RACE_STATUS, fmtTime } from '@/lib/labels';

export default function VolunteerPage() {
  const { ready } = useRequireRole('VOLUNTEER', 'OPS');
  const [notifications, setNotifications] = useState<any[]>([]);
  const [races, setRaces] = useState<any[]>([]);
  const [raceId, setRaceId] = useState('');
  const [withdrawals, setWithdrawals] = useState<any[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    api('events/notifications/mine').then(setNotifications).catch((e) => setError(e.message));
    api('races').then((list) => {
      setRaces(list);
      const rd = list.find((r) => r.status === 'RACE_DAY') || list[0];
      if (rd) setRaceId(rd.id);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (raceId) api(`withdrawals/race/${raceId}`).then(setWithdrawals).catch(() => {});
  }, [raceId]);

  if (!ready) return null;
  const shuttle = withdrawals.filter((w) => w.needsShuttle);

  return (
    <div>
      <Nav />
      <div className="container">
        <ErrorBox error={error} />
        <div className="grid2">
          <div className="card">
            <h2>岗位通知（裁判/运营/事件推送）</h2>
            {notifications.length === 0 ? <div className="muted">暂无通知</div> : (
              <table>
                <thead><tr><th>时间</th><th>通知</th></tr></thead>
                <tbody>
                  {notifications.map((n) => (
                    <tr key={n.id}>
                      <td className="small" style={{ width: 140 }}>{fmtTime(n.createdAt)}</td>
                      <td>
                        <strong className="small">{n.title}</strong>
                        {n.message && <div className="small muted">{n.message}</div>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
          <div className="card">
            <h2>
              退赛接驳任务
              <select style={{ width: 260, marginLeft: 'auto' }} value={raceId} onChange={(e) => setRaceId(e.target.value)}>
                {races.map((r) => <option key={r.id} value={r.id}>{r.name}（{RACE_STATUS[r.status]?.[0]}）</option>)}
              </select>
            </h2>
            {shuttle.length === 0 ? <div className="muted">当前没有需要接驳的退赛选手</div> : (
              <table>
                <thead><tr><th>时间</th><th>号码</th><th>组别</th><th>位置</th><th>原因</th><th>车辆</th></tr></thead>
                <tbody>
                  {shuttle.map((w) => (
                    <tr key={w.id}>
                      <td className="small">{fmtTime(w.reportedAt)}</td>
                      <td><strong>{w.bibNumber}</strong></td>
                      <td>{w.group}</td>
                      <td className="small">{w.pointName || (w.kmMark != null ? `${w.kmMark}km` : '—')}</td>
                      <td className="small">{w.reason}</td>
                      <td><Badge color={w.vehicleStatus === 'OK' ? 'green' : 'orange'}>{w.vehicleStatus}</Badge></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            <h3 style={{ marginTop: 16 }}>全部退赛记录</h3>
            <table>
              <thead><tr><th>时间</th><th>号码</th><th>位置</th><th>接驳</th></tr></thead>
              <tbody>
                {withdrawals.map((w) => (
                  <tr key={w.id}>
                    <td className="small">{fmtTime(w.reportedAt)}</td>
                    <td>{w.bibNumber}</td>
                    <td className="small">{w.pointName || (w.kmMark != null ? `${w.kmMark}km` : '—')}</td>
                    <td>{w.needsShuttle ? <Badge color="orange">需要</Badge> : '否'}</td>
                  </tr>
                ))}
                {withdrawals.length === 0 && <tr><td colSpan={4} className="muted">暂无退赛记录</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
