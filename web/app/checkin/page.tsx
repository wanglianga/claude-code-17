'use client';

import { useEffect, useState } from 'react';
import Nav from '@/components/Nav';
import { Badge, ErrorBox, OkBox, useRequireRole } from '@/components/ui';
import { api } from '@/lib/api';
import { RACE_STATUS, VEHICLE_TYPES } from '@/lib/labels';
import { ShorteningBanner } from '@/components/ShorteningBanner';
import ShorteningTaskBoard from '@/components/ShorteningTaskBoard';

const CHECK_ITEMS: Array<[string, string]> = [
  ['idVerified', '证件核验'],
  ['helmetOk', '头盔'],
  ['numberPlateOk', '号码牌'],
  ['chipOk', '计时芯片'],
  ['brakesOk', '车辆刹车'],
  ['insuranceOk', '保险'],
];

export default function CheckInPage() {
  const { ready } = useRequireRole('CHECKIN', 'OPS');
  const [races, setRaces] = useState<any[]>([]);
  const [raceId, setRaceId] = useState('');
  const [rows, setRows] = useState<any[]>([]);
  const [queue, setQueue] = useState<any[]>([]);
  const [tab, setTab] = useState('checkin');
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');
  const [active, setActive] = useState<any>(null);
  const [checks, setChecks] = useState<Record<string, boolean>>({});
  const [notes, setNotes] = useState('');

  useEffect(() => {
    api('races').then((list) => {
      setRaces(list);
      const rd = list.find((r) => r.status === 'RACE_DAY');
      if (rd) setRaceId(rd.id);
      else if (list.length) setRaceId(list[0].id);
    }).catch((e) => setError(e.message));
  }, []);

  const load = async (id: string) => {
    if (!id) return;
    try {
      const [list, q] = await Promise.all([api(`checkins/race/${id}`), api(`checkins/race/${id}/queue`)]);
      setRows(list);
      setQueue(q);
    } catch (e: any) { setError(e.message); }
  };
  useEffect(() => { load(raceId); }, [raceId]);

  const openCheck = (r: any) => {
    setActive(r);
    setNotes(r.checkIn?.notes || '');
    const c: Record<string, boolean> = {};
    for (const [k] of CHECK_ITEMS) c[k] = r.checkIn ? !!r.checkIn[k] : false;
    setChecks(c);
    setError(''); setOk('');
  };

  const submit = async () => {
    try {
      const res = await api('checkins', { method: 'POST', body: { registrationId: active.id, ...checks, notes } });
      setOk(res.status === 'PASSED' ? `号码 ${active.bibNumber} 检录通过，已进入发车队列` : `号码 ${active.bibNumber} 检录未通过，不能进入发车队列`);
      setActive(null);
      await load(raceId);
    } catch (e: any) { setError(e.message); }
  };

  if (!ready) return null;
  const race = races.find((r) => r.id === raceId);

  return (
    <div>
      <Nav />
      <div className="container">
        <ErrorBox error={error} /><OkBox message={ok} />
        <div className="card">
          <h2>
            检录工作台
            <select style={{ width: 320, marginLeft: 'auto' }} value={raceId} onChange={(e) => setRaceId(e.target.value)}>
              {races.map((r) => <option key={r.id} value={r.id}>{r.name}（{RACE_STATUS[r.status]?.[0]}）</option>)}
            </select>
          </h2>
          {race && race.status !== 'RACE_DAY' && (
            <div className="alert info">该赛事当前状态为「{RACE_STATUS[race.status]?.[0]}」，检录仅比赛日可提交（可预览名单）。</div>
          )}
          <ShorteningBanner raceId={raceId} />
          {race?.status === 'RACE_DAY' && (
            <div style={{ marginBottom: 14 }}>
              <ShorteningTaskBoard raceId={raceId} canAck={true} postsOnly pointTypes={['START', 'FINISH', 'TIMING', 'TRAFFIC_CONTROL']} />
            </div>
          )}
          <div className="tabs">
            <button className={tab === 'checkin' ? 'active' : ''} onClick={() => setTab('checkin')}>检录名单（{rows.length}）</button>
            <button className={tab === 'queue' ? 'active' : ''} onClick={() => setTab('queue')}>发车队列（{queue.length}）</button>
          </div>

          {tab === 'checkin' && (
            <table>
              <thead><tr><th>号码</th><th>选手</th><th>组别</th><th>证件</th><th>车辆</th><th>保险有效期</th><th>检录状态</th><th></th></tr></thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td><strong>{r.bibNumber}</strong></td>
                    <td>{r.rider?.displayName}</td>
                    <td>{r.group?.name}</td>
                    <td className="small">{r.profile?.idType} {r.profile?.idNumber}</td>
                    <td className="small">{VEHICLE_TYPES[r.profile?.vehicleType] || r.profile?.vehicleType}</td>
                    <td className="small">{r.profile?.insuranceValidUntil || '—'}</td>
                    <td>
                      {r.checkIn ? (
                        <Badge color={r.checkIn.status === 'PASSED' ? 'green' : 'red'}>{r.checkIn.status === 'PASSED' ? '已通过' : '未通过'}</Badge>
                      ) : (
                        <Badge color="gray">未检录</Badge>
                      )}
                      {r.checkIn?.notes && <div className="small muted">{r.checkIn.notes}</div>}
                    </td>
                    <td><button className="btn sm primary" onClick={() => openCheck(r)}>检录</button></td>
                  </tr>
                ))}
                {rows.length === 0 && <tr><td colSpan={8} className="muted">暂无审核通过的报名</td></tr>}
              </tbody>
            </table>
          )}

          {tab === 'queue' && (
            <div>
              <p className="muted small">仅检录全部通过的选手可进入发车队列，按组别发车时间排序。</p>
              <table>
                <thead><tr><th>组别（发车时间）</th><th>号码</th><th>选手</th><th>芯片</th></tr></thead>
                <tbody>
                  {queue.map((r) => (
                    <tr key={r.id}>
                      <td>{r.group?.name} <span className="muted small">{r.group?.startTime}</span></td>
                      <td><strong>{r.bibNumber}</strong></td>
                      <td>{r.rider?.displayName}</td>
                      <td className="small">{r.chipId}</td>
                    </tr>
                  ))}
                  {queue.length === 0 && <tr><td colSpan={4} className="muted">发车队列为空</td></tr>}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {active && (
          <div className="card">
            <h2>检录：{active.bibNumber} · {active.rider?.displayName}（{active.group?.name}）</h2>
            <p className="muted small">逐项核验：证件 / 头盔 / 号码牌 / 芯片 / 车辆刹车 / 保险。全部通过方可进入发车队列。</p>
            <div className="checks">
              {CHECK_ITEMS.map(([k, label]) => (
                <label key={k} className={checks[k] ? 'on' : ''}>
                  <input type="checkbox" checked={!!checks[k]} onChange={(e) => setChecks({ ...checks, [k]: e.target.checked })} />
                  {label}
                </label>
              ))}
            </div>
            <div className="field">
              <label>备注（未通过原因等）</label>
              <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="如：刹车手感偏软，已现场调试" />
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn primary" onClick={submit}>提交检录结果（{Object.values(checks).every(Boolean) ? '通过' : '不通过'}）</button>
              <button className="btn" onClick={() => setActive(null)}>取消</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
