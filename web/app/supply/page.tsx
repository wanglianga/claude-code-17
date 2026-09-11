'use client';

import { useEffect, useState } from 'react';
import Nav from '@/components/Nav';
import { Badge, ErrorBox, OkBox, useRequireRole } from '@/components/ui';
import { api } from '@/lib/api';
import { POINT_TYPES, RACE_STATUS, fmtTime } from '@/lib/labels';
import { ShorteningBanner } from '@/components/ShorteningBanner';
import ShorteningTaskBoard from '@/components/ShorteningTaskBoard';

export default function SupplyPage() {
  const { ready } = useRequireRole('SUPPLY', 'OPS');
  const [races, setRaces] = useState<any[]>([]);
  const [raceId, setRaceId] = useState('');
  const [detail, setDetail] = useState<any>(null);
  const [summary, setSummary] = useState<any>(null);
  const [pointId, setPointId] = useState('');
  const [regId, setRegId] = useState('');
  const [riders, setRiders] = useState<any[]>([]);
  const [form, setForm] = useState({ water: 0, gels: 0, repairParts: 0, note: '' });
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
      const [d, s, regs] = await Promise.all([
        api(`races/${id}`),
        api(`supplies/race/${id}/summary`),
        api(`checkins/race/${id}`).catch(() => []),
      ]);
      setDetail(d);
      setSummary(s);
      setRiders(regs);
      const supplyPoints = (d.routes?.[0]?.points || []).filter((p: any) => ['SUPPLY', 'REPAIR'].includes(p.type));
      if (supplyPoints.length && !pointId) setPointId(supplyPoints[0].id);
    } catch (e: any) { setError(e.message); }
  };
  useEffect(() => { load(raceId); }, [raceId]);

  const submit = async () => {
    setError(''); setOk('');
    try {
      const res = await api('supplies/records', {
        method: 'POST',
        body: { routePointId: pointId, registrationId: regId || undefined, ...form },
      });
      setOk(`已记录。当前库存：饮水 ${res.point.waterStock} / 能量胶 ${res.point.gelStock} / 配件 ${res.point.partsStock}`);
      setForm({ water: 0, gels: 0, repairParts: 0, note: '' });
      setRegId('');
      await load(raceId);
    } catch (e: any) { setError(e.message); }
  };

  if (!ready) return null;
  const supplyPoints = (detail?.routes?.[0]?.points || []).filter((p: any) => ['SUPPLY', 'REPAIR'].includes(p.type) && p.isActive !== false);
  const evacuatedPoints = (detail?.routes?.[0]?.points || []).filter((p: any) => ['SUPPLY', 'REPAIR'].includes(p.type) && p.isActive === false);
  const point = supplyPoints.find((p: any) => p.id === pointId);
  const race = races.find((r) => r.id === raceId);

  return (
    <div>
      <Nav />
      <div className="container">
        <ErrorBox error={error} /><OkBox message={ok} />
        <div className="card">
          <h2>
            补给点工作台
            <select style={{ width: 320, marginLeft: 'auto' }} value={raceId} onChange={(e) => { setRaceId(e.target.value); setPointId(''); }}>
              {races.map((r) => <option key={r.id} value={r.id}>{r.name}（{RACE_STATUS[r.status]?.[0]}）</option>)}
            </select>
          </h2>
          {race?.status !== 'RACE_DAY' && <div className="alert info">仅比赛日可登记补给记录（当前可查看点位与库存）。</div>}
          <ShorteningBanner raceId={raceId} />
          <div className="grid2">
            <div>
              <div className="field">
                <label>选择点位</label>
                <select value={pointId} onChange={(e) => setPointId(e.target.value)}>
                  {supplyPoints.map((p: any) => (
                    <option key={p.id} value={p.id}>{p.name}（{POINT_TYPES[p.type]} · {p.kmMark}km）</option>
                  ))}
                </select>
              </div>
              {point && (
                <div className="grid3" style={{ marginBottom: 12 }}>
                  <div className="stat"><div className="num">{point.waterStock}</div><div className="lbl">饮水库存</div></div>
                  <div className="stat"><div className="num">{point.gelStock}</div><div className="lbl">能量胶库存</div></div>
                  <div className="stat"><div className="num">{point.partsStock}</div><div className="lbl">配件库存</div></div>
                </div>
              )}
              <div className="field">
                <label>通过选手（可选，仅记录物资可不选）</label>
                <select value={regId} onChange={(e) => setRegId(e.target.value)}>
                  <option value="">— 不关联选手 —</option>
                  {riders.map((r) => (
                    <option key={r.id} value={r.id}>{r.bibNumber} · {r.rider?.displayName}（{r.group?.name}）</option>
                  ))}
                </select>
              </div>
              <div className="form-row3">
                <div className="field"><label>饮水（瓶）</label><input type="number" min="0" value={form.water} onChange={(e) => setForm({ ...form, water: +e.target.value })} /></div>
                <div className="field"><label>能量胶（支）</label><input type="number" min="0" value={form.gels} onChange={(e) => setForm({ ...form, gels: +e.target.value })} /></div>
                <div className="field"><label>维修配件（件）</label><input type="number" min="0" value={form.repairParts} onChange={(e) => setForm({ ...form, repairParts: +e.target.value })} /></div>
              </div>
              <div className="field"><label>备注</label><input value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} placeholder="如：选手状态良好 / 需要补充库存" /></div>
              <button className="btn primary" onClick={submit} disabled={!pointId || race?.status !== 'RACE_DAY'}>登记通过/发放</button>
              <p className="small muted" style={{ marginTop: 8 }}>库存不足时将自动生成「补给异常」并通知补给与裁判岗位。</p>
            </div>
            <div>
              <h3>点位发放汇总</h3>
              <table>
                <thead><tr><th>点位</th><th>通过</th><th>饮水</th><th>胶</th><th>配件</th><th>余量</th></tr></thead>
                <tbody>
                  {(summary?.points || []).map((s: any) => (
                    <tr key={s.point.id}>
                      <td className="small">{s.point.name}</td>
                      <td>{s.ridersPassed}</td>
                      <td>{s.waterGiven}</td>
                      <td>{s.gelsGiven}</td>
                      <td>{s.partsGiven}</td>
                      <td>
                        {s.point.waterStock}/{s.point.gelStock}/{s.point.partsStock}{' '}
                        {(s.point.waterStock === 0 || s.point.gelStock === 0) && <Badge color="red">告急</Badge>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
        {evacuatedPoints.length > 0 && (
          <div className="alert info" style={{ marginTop: 12 }}>
            撤销路段补给点：{evacuatedPoints.map((p: any) => `「${p.name}」`).join('、')} 已停止发放，库存按任务单前移，新关门时间 {evacuatedPoints[0]?.cutoffTime || '—'}。
          </div>
        )}
        <div className="card">
          <h2>缩短任务与岗位签收</h2>
          <ShorteningTaskBoard raceId={raceId} roleFilter="SUPPLY" canAck={true} onChange={() => load(raceId)} />
        </div>
        <div className="card">
          <h2>最近记录</h2>          <table>
            <thead><tr><th>时间</th><th>点位</th><th>选手</th><th>饮水</th><th>胶</th><th>配件</th><th>备注</th></tr></thead>
            <tbody>
              {(summary?.records || []).slice(0, 20).map((r: any) => (
                <tr key={r.id}>
                  <td className="small">{fmtTime(r.passedAt)}</td>
                  <td className="small">{summary?.points?.find((p: any) => p.point.id === r.routePointId)?.point?.name || r.routePointId.slice(0, 8)}</td>
                  <td className="small">{r.registrationId ? riders.find((x) => x.id === r.registrationId)?.bibNumber || '—' : '—'}</td>
                  <td>{r.water}</td><td>{r.gels}</td><td>{r.repairParts}</td>
                  <td className="small">{r.note}</td>
                </tr>
              ))}
              {(summary?.records || []).length === 0 && <tr><td colSpan={7} className="muted">暂无记录</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
