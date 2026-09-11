'use client';

import { useEffect, useState } from 'react';
import Nav from '@/components/Nav';
import { Badge, ErrorBox, OkBox, useRequireRole } from '@/components/ui';
import { api } from '@/lib/api';
import { EVENT_TYPES, POINT_TYPES, RACE_STATUS, SEVERITY, fmtTime } from '@/lib/labels';
import { ShorteningBanner } from '@/components/ShorteningBanner';
import ShorteningTaskBoard from '@/components/ShorteningTaskBoard';
export default function MedicalPage() {
  const { ready } = useRequireRole('MEDICAL', 'OPS');
  const [races, setRaces] = useState<any[]>([]);
  const [raceId, setRaceId] = useState('');
  const [detail, setDetail] = useState<any>(null);
  const [events, setEvents] = useState<any[]>([]);
  const [records, setRecords] = useState<any[]>([]);
  const [riders, setRiders] = useState<any[]>([]);
  const [form, setForm] = useState<any>({ registrationId: '', routePointId: '', condition: '', treatment: '', severity: 'MINOR', outcome: '' });
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');

  useEffect(() => {
    api('races').then((list) => {
      setRaces(list);
      const rd = list.find((r) => r.status === 'RACE_DAY') || list[0];
      if (rd) setRaceId(rd.id);
    }).catch((e) => setError(e.message));
  }, []);

  const load = async (id: string) => {
    if (!id) return;
    try {
      const [d, ev, recs, regs] = await Promise.all([
        api(`races/${id}`),
        api(`events/race/${id}`),
        api(`medical/race/${id}`),
        api(`checkins/race/${id}`).catch(() => []),
      ]);
      setDetail(d);
      setEvents(ev.filter((e) => ['CRASH', 'WEATHER', 'GROUP_STUCK'].includes(e.type)));
      setRecords(recs);
      setRiders(regs);
    } catch (e: any) { setError(e.message); }
  };
  useEffect(() => { load(raceId); }, [raceId]);

  const submit = async () => {
    setError(''); setOk('');
    try {
      await api('medical', {
        method: 'POST',
        body: { ...form, raceId, registrationId: form.registrationId || undefined, routePointId: form.routePointId || undefined },
      });
      setOk('医疗处置已登记并进入统一时间轴');
      setForm({ registrationId: '', routePointId: '', condition: '', treatment: '', severity: 'MINOR', outcome: '' });
      await load(raceId);
    } catch (e: any) { setError(e.message); }
  };

  if (!ready) return null;
  const medPoints = (detail?.routes?.[0]?.points || []).filter((p: any) => ['MEDICAL', 'SUPPLY', 'FINISH'].includes(p.type));

  return (
    <div>
      <Nav />
      <div className="container">
        <ErrorBox error={error} /><OkBox message={ok} />
        <div className="card">
          <h2>
            医疗工作台
            <select style={{ width: 320, marginLeft: 'auto' }} value={raceId} onChange={(e) => setRaceId(e.target.value)}>
              {races.map((r) => <option key={r.id} value={r.id}>{r.name}（{RACE_STATUS[r.status]?.[0]}）</option>)}
            </select>
          </h2>
          <ShorteningBanner raceId={raceId} />
          <div style={{ marginBottom: 14 }}>
            <ShorteningTaskBoard raceId={raceId} canAck={true} postsOnly pointTypes={['MEDICAL', 'SUPPLY', 'FINISH', 'TIMING']} />
          </div>
          <div className="grid2">
            <div>
              <h3>医疗相关事件</h3>
              <table>
                <thead><tr><th>时间</th><th>类型</th><th>级别</th><th>标题</th></tr></thead>
                <tbody>
                  {events.map((e) => (
                    <tr key={e.id}>
                      <td className="small">{fmtTime(e.createdAt)}</td>
                      <td>{EVENT_TYPES[e.type]}</td>
                      <td><Badge color={SEVERITY[e.severity]?.[1]}>{SEVERITY[e.severity]?.[0]}</Badge></td>
                      <td className="small">{e.title}</td>
                    </tr>
                  ))}
                  {events.length === 0 && <tr><td colSpan={4} className="muted">暂无相关事件</td></tr>}
                </tbody>
              </table>
              <h3 style={{ marginTop: 16 }}>登记医疗处置</h3>
              <div className="field"><label>选手（可选）</label>
                <select value={form.registrationId} onChange={(e) => setForm({ ...form, registrationId: e.target.value })}>
                  <option value="">— 非选手/不关联 —</option>
                  {riders.map((r) => <option key={r.id} value={r.id}>{r.bibNumber} · {r.rider?.displayName}</option>)}
                </select>
              </div>
              <div className="form-row">
                <div className="field"><label>处置点位</label>
                  <select value={form.routePointId} onChange={(e) => setForm({ ...form, routePointId: e.target.value })}>
                    <option value="">—</option>
                    {medPoints.map((p: any) => <option key={p.id} value={p.id}>{p.name}（{POINT_TYPES[p.type]}）</option>)}
                  </select>
                </div>
                <div className="field"><label>严重程度</label>
                  <select value={form.severity} onChange={(e) => setForm({ ...form, severity: e.target.value })}>
                    <option value="MINOR">轻微</option><option value="MODERATE">中等</option><option value="SEVERE">严重</option>
                  </select>
                </div>
              </div>
              <div className="field"><label>伤情/病情</label><input value={form.condition} onChange={(e) => setForm({ ...form, condition: e.target.value })} placeholder="如：下坡摔车，左肘擦伤" /></div>
              <div className="field"><label>处置措施</label><input value={form.treatment} onChange={(e) => setForm({ ...form, treatment: e.target.value })} placeholder="如：清创包扎，观察 15 分钟" /></div>
              <div className="field"><label>转归</label><input value={form.outcome} onChange={(e) => setForm({ ...form, outcome: e.target.value })} placeholder="如：继续参赛 / 送医 / 退赛" /></div>
              <button className="btn primary" onClick={submit} disabled={!form.condition || !form.treatment}>登记处置</button>
            </div>
            <div>
              <h3>处置记录</h3>
              <table>
                <thead><tr><th>时间</th><th>号码</th><th>点位</th><th>伤情</th><th>处置</th><th>转归</th></tr></thead>
                <tbody>
                  {records.map((r) => (
                    <tr key={r.id}>
                      <td className="small">{fmtTime(r.createdAt)}</td>
                      <td>{r.bibNumber || '—'}</td>
                      <td className="small">{r.pointName || '—'}</td>
                      <td className="small">{r.condition}</td>
                      <td className="small">{r.treatment}</td>
                      <td className="small">{r.outcome || '—'}</td>
                    </tr>
                  ))}
                  {records.length === 0 && <tr><td colSpan={6} className="muted">暂无处置记录</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
