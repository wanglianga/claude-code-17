'use client';

import { useEffect, useState } from 'react';
import { Badge } from './ui';
import { api } from '@/lib/api';
import { POINT_TYPES, WEATHER_KINDS, WEATHER_SEVERITY, SHORTENING_STATUS, fmtTime } from '@/lib/labels';

/**
 * 运营天气应急面板：
 * 录入大风/暴雨/高温预警 → 平台评估（位置/补给/医疗/管制）→ 调整关门时间 → 提交方案待裁判确认
 */
export default function WeatherShorteningPanel({ race, onChange }: { race: any; onChange?: () => void }) {
  const [alerts, setAlerts] = useState<any[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState('');
  const [assessment, setAssessment] = useState<any>(null);
  const [junctionId, setJunctionId] = useState('');
  const [cutoffs, setCutoffs] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  const load = () =>
    api(`weather-alerts/race/${race.id}`)
      .then(setAlerts)
      .catch((e) => setError(e.message));
  useEffect(() => {
    load();
  }, [race.id]);

  const assess = async (alertId: string) => {
    setError('');
    try {
      const a = await api('shortenings/assess', { method: 'POST', body: { alertId } });
      setAssessment(a);
      setJunctionId(a.junction?.id || '');
      const cc: Record<string, string> = {};
      for (const g of a.groups) cc[g.groupId] = g.recommendedCutoff;
      setCutoffs(cc);
    } catch (e: any) {
      setError(e.message);
    }
  };

  const propose = async () => {
    setBusy(true);
    setError('');
    try {
      await api('shortenings', {
        method: 'POST',
        body: {
          alertId: assessment.alert.id,
          newFinishPointId: junctionId,
          cutoffByGroup: cutoffs,
        },
      });
      setAssessment(null);
      await load();
      onChange?.();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      {error && <div className="alert error">{error}</div>}
      <div className="card">
        <h2>
          天气预警与赛段缩短评估
          <button className="btn primary sm" style={{ marginLeft: 'auto' }} onClick={() => setShowForm(!showForm)}>
            {showForm ? '收起' : '+ 录入天气预警'}
          </button>
        </h2>
        {showForm && <AlertForm race={race} onCreated={() => { setShowForm(false); load(); }} />}
        <table>
          <thead>
            <tr><th>时间</th><th>类型</th><th>级别</th><th>预警</th><th>影响赛段</th><th>方案</th><th></th></tr>
          </thead>
          <tbody>
            {alerts.map((a) => (
              <tr key={a.id}>
                <td className="small">{fmtTime(a.createdAt)}<div className="muted">{a.issuedAt}-{a.effectiveUntil}</div></td>
                <td><Badge color="blue">{WEATHER_KINDS[a.kind]}</Badge></td>
                <td><Badge color={WEATHER_SEVERITY[a.severity]?.[1]}>{WEATHER_SEVERITY[a.severity]?.[0]}</Badge></td>
                <td>{a.title}{a.description && <div className="small muted">{a.description}</div>}</td>
                <td className="small">{a.affectedFromKm != null ? `${a.affectedFromKm}km${a.affectedToKm != null ? `-${a.affectedToKm}km` : ' 以后'}` : '全程'}</td>
                <td>{a.shortening ? <Badge color={SHORTENING_STATUS[a.shortening.status]?.[1]}>{SHORTENING_STATUS[a.shortening.status]?.[0]}</Badge> : <span className="muted">未评估</span>}</td>
                <td>{!a.shortening && <button className="btn sm primary" onClick={() => assess(a.id)}>评估是否缩短</button>}</td>
              </tr>
            ))}
            {alerts.length === 0 && <tr><td colSpan={7} className="muted">暂无天气预警</td></tr>}
          </tbody>
        </table>
      </div>

      {assessment && (
        <div className="card" style={{ borderColor: '#e0a800' }}>
          <h2>
            缩短评估：{WEATHER_KINDS[assessment.alert.kind]} · {assessment.alert.title}
            <button className="btn sm" style={{ marginLeft: 'auto' }} onClick={() => setAssessment(null)}>关闭评估</button>
          </h2>
          <h3>关键路口（建议新终点）</h3>
          <div className="field">
            <select value={junctionId} onChange={(e) => setJunctionId(e.target.value)}>
              {assessment.candidates.map((c: any) => (
                <option key={c.id} value={c.id}>{c.name}（{POINT_TYPES[c.type]} · {c.kmMark}km）{c.staffed ? '' : ' · 无人值守'}</option>
              ))}
            </select>
          </div>
          <h3>分组评估（当前位置 / 已过·未过关键路口 / 建议关门）</h3>
          <table>
            <thead>
              <tr><th>组别</th><th>在途</th><th>已过路口</th><th>未过路口</th><th>未过最远位置</th><th>抵达预计</th><th>补给需求(水/胶)</th><th>医疗空余</th><th>管制剩余</th><th>新关门时间</th></tr>
            </thead>
            <tbody>
              {assessment.groups.map((g: any) => (
                <tr key={g.groupId}>
                  <td>{g.groupName}</td>
                  <td>{g.onCourse}</td>
                  <td>{g.aheadCount} <span className="small muted">{g.aheadBibs.join('、')}</span></td>
                  <td>{g.behindCount} <span className="small muted">{g.behindBibs.join('、')}</span></td>
                  <td>{g.furthestBehindKm}km</td>
                  <td>{g.etaMin} 分钟</td>
                  <td>{g.waterDemand}/{g.gelDemand}</td>
                  <td>{g.medical ? `${g.medical.free}/${g.medical.capacity}` : '—'}</td>
                  <td className={g.controlRisk ? '' : 'small'}>
                    {g.traffic ? <>{g.traffic.name} {g.traffic.expired ? '管制已解除 ⚠' : <>余 {g.traffic.remainingMin} 分{g.controlRisk ? ' ⚠不足' : ''}</>}</> : '—'}
                  </td>
                  <td><input value={cutoffs[g.groupId] || ''} onChange={(e) => setCutoffs({ ...cutoffs, [g.groupId]: e.target.value })} style={{ width: 80 }} placeholder="HH:mm" /></td>
                </tr>
              ))}
            </tbody>
          </table>
          <h3>补给消耗</h3>
          <table>
            <thead><tr><th>点位</th><th>公里</th><th>已耗水/胶/件</th><th>剩余水/胶/件</th></tr></thead>
            <tbody>
              {assessment.supply.map((s: any) => (
                <tr key={s.pointId}><td className="small">{s.name}</td><td>{s.kmMark}km</td><td>{s.waterUsed}/{s.gelsUsed}/{s.partsUsed}</td><td>{s.waterLeft}/{s.gelsLeft}/{s.partsLeft}</td></tr>
              ))}
            </tbody>
          </table>
          <h3>评估依据</h3>
          <ul className="small muted">
            {assessment.factors.map((f: string, i: number) => <li key={i}>{f}</li>)}
          </ul>
          <button className="btn primary" disabled={!junctionId || busy} onClick={propose}>提交缩短方案（待裁判确认）</button>
        </div>
      )}
    </div>
  );
}

function AlertForm({ race, onCreated }: { race: any; onCreated: () => void }) {
  const [form, setForm] = useState<any>({
    kind: 'WIND', severity: 'WARNING', title: '', description: '',
    issuedAt: '10:30', effectiveUntil: '13:00', affectedFromKm: 35, affectedToKm: 60, groupIds: [],
  });
  const [error, setError] = useState('');
  const toggle = (id: string) =>
    setForm((f: any) => ({ ...f, groupIds: f.groupIds.includes(id) ? f.groupIds.filter((x: string) => x !== id) : [...f.groupIds, id] }));
  const submit = async () => {
    try {
      await api('weather-alerts', {
        method: 'POST',
        body: {
          ...form,
          raceId: race.id,
          affectedFromKm: form.affectedFromKm === '' ? null : Number(form.affectedFromKm),
          affectedToKm: form.affectedToKm === '' ? null : Number(form.affectedToKm),
        },
      });
      onCreated();
    } catch (e: any) {
      setError(e.message);
    }
  };
  return (
    <div style={{ border: '1px dashed var(--border)', borderRadius: 8, padding: 14, margin: '10px 0' }}>
      {error && <div className="alert error">{error}</div>}
      <div className="form-row3">
        <div className="field"><label>预警类型</label>
          <select value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value })}>
            {Object.entries(WEATHER_KINDS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
        <div className="field"><label>级别</label>
          <select value={form.severity} onChange={(e) => setForm({ ...form, severity: e.target.value })}>
            {Object.entries(WEATHER_SEVERITY).map(([k, [l]]) => <option key={k} value={k}>{l}</option>)}
          </select>
        </div>
        <div className="field"><label>标题</label><input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="如：阵风 8 级，沿江路段" /></div>
      </div>
      <div className="form-row3">
        <div className="field"><label>发布时间</label><input value={form.issuedAt} onChange={(e) => setForm({ ...form, issuedAt: e.target.value })} placeholder="HH:mm" /></div>
        <div className="field"><label>预计解除</label><input value={form.effectiveUntil} onChange={(e) => setForm({ ...form, effectiveUntil: e.target.value })} placeholder="HH:mm" /></div>
        <div className="field"><label>影响赛段起(km)</label><input type="number" value={form.affectedFromKm} onChange={(e) => setForm({ ...form, affectedFromKm: e.target.value })} /></div>
      </div>
      <div className="form-row">
        <div className="field"><label>影响赛段止(km，空=至终点)</label><input type="number" value={form.affectedToKm} onChange={(e) => setForm({ ...form, affectedToKm: e.target.value })} /></div>
        <div className="field"><label>说明</label><input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
      </div>
      <div className="field">
        <label>影响组别（不选 = 全部）</label>
        <div className="checks">
          {race.groups.map((g: any) => (
            <label key={g.id} className={form.groupIds.includes(g.id) ? 'on' : ''}>
              <input type="checkbox" checked={form.groupIds.includes(g.id)} onChange={() => toggle(g.id)} /> {g.name}
            </label>
          ))}
        </div>
      </div>
      <button className="btn primary" disabled={!form.title || !form.issuedAt || !form.effectiveUntil} onClick={submit}>录入并通知各岗位</button>
    </div>
  );
}
