'use client';

import { useEffect, useState } from 'react';
import Nav from '@/components/Nav';
import ResultsView from '@/components/ResultsView';
import TimelineView from '@/components/TimelineView';
import { Badge, ErrorBox, OkBox, useRequireRole } from '@/components/ui';
import { api } from '@/lib/api';
import { APPEAL_STATUS, EVENT_STATUS, EVENT_TYPES, POINT_TYPES, RACE_STATUS, SEVERITY, SHORTENING_STATUS, WEATHER_KINDS, fmtTime } from '@/lib/labels';
import ShorteningTaskBoard from '@/components/ShorteningTaskBoard';
import { ShorteningBanner } from '@/components/ShorteningBanner';

export default function RefereePage() {
  const { ready } = useRequireRole('REFEREE', 'OPS');
  const [races, setRaces] = useState<any[]>([]);
  const [raceId, setRaceId] = useState('');
  const [detail, setDetail] = useState<any>(null);
  const [tab, setTab] = useState('events');
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');

  useEffect(() => {
    api('races').then((list) => {
      setRaces(list);
      const rd = list.find((r) => r.status === 'RACE_DAY') || list[0];
      if (rd) setRaceId(rd.id);
    }).catch((e) => setError(e.message));
  }, []);

  useEffect(() => {
    if (!raceId) return;
    api(`races/${raceId}`).then(setDetail).catch((e) => setError(e.message));
  }, [raceId]);

  if (!ready) return null;
  const notify = (msg: string) => { setOk(msg); setTimeout(() => setOk(''), 4000); };

  return (
    <div>
      <Nav />
      <div className="container">
        <ErrorBox error={error} /><OkBox message={ok} />
        <div className="card">
          <h2>
            裁判工作台
            <select style={{ width: 320, marginLeft: 'auto' }} value={raceId} onChange={(e) => setRaceId(e.target.value)}>
              {races.map((r) => <option key={r.id} value={r.id}>{r.name}（{RACE_STATUS[r.status]?.[0]}）</option>)}
            </select>
          </h2>
          {detail && (
            <div className="tabs">
              {[['events', '赛道事件'], ['shortening', '赛段缩短'], ['instruction', '发布指令'], ['appeals', '申诉处理'], ['timing', '计时/成绩'], ['timeline', '时间轴']].map(([k, l]) => (
                <button key={k} className={tab === k ? 'active' : ''} onClick={() => setTab(k)}>{l}</button>
              ))}
            </div>
          )}
          {detail && tab === 'events' && <EventsTab race={detail} notify={notify} setError={setError} />}
          {detail && tab === 'shortening' && <ShorteningTab race={detail} notify={notify} setError={setError} />}
          {detail && tab === 'instruction' && <InstructionTab race={detail} notify={notify} setError={setError} />}
          {detail && tab === 'appeals' && <AppealsTab race={detail} notify={notify} setError={setError} />}
          {detail && tab === 'timing' && <TimingTab race={detail} notify={notify} setError={setError} />}
          {detail && tab === 'timeline' && <TimelineView raceId={detail.id} groups={detail.groups} />}
        </div>
      </div>
    </div>
  );
}

function EventsTab({ race, notify, setError }: any) {
  const [events, setEvents] = useState<any[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<any>({ type: 'WEATHER', title: '', description: '', severity: 'WARNING', groupId: '', routePointId: '' });
  const points = race.routes?.[0]?.points || [];

  const load = () => api(`events/race/${race.id}`).then(setEvents).catch((e) => setError(e.message));
  useEffect(() => { load(); }, [race.id]);

  const create = async () => {
    try {
      const res = await api('events', {
        method: 'POST',
        body: { ...form, raceId: race.id, groupId: form.groupId || undefined, routePointId: form.routePointId || undefined },
      });
      notify(`事件已上报，已通知：${res.notifiedRoles.join('、')}`);
      setShowForm(false);
      setForm({ type: 'WEATHER', title: '', description: '', severity: 'WARNING', groupId: '', routePointId: '' });
      load();
    } catch (e: any) { setError(e.message); }
  };
  const setStatus = async (id: string, status: string) => {
    try { await api(`events/${id}/status`, { method: 'POST', body: { status } }); load(); } catch (e: any) { setError(e.message); }
  };

  return (
    <div>
      <div style={{ marginBottom: 12 }}>
        <button className="btn primary sm" onClick={() => setShowForm(!showForm)}>{showForm ? '收起' : '+ 上报事件'}</button>
      </div>
      {showForm && (
        <div className="card" style={{ background: '#fafbfc' }}>
          <div className="form-row3">
            <div className="field"><label>事件类型</label>
              <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                {Object.entries(EVENT_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div className="field"><label>级别</label>
              <select value={form.severity} onChange={(e) => setForm({ ...form, severity: e.target.value })}>
                {Object.entries(SEVERITY).map(([k, [l]]) => <option key={k} value={k}>{l}</option>)}
              </select>
            </div>
            <div className="field"><label>影响组别</label>
              <select value={form.groupId} onChange={(e) => setForm({ ...form, groupId: e.target.value })}>
                <option value="">全部/不限</option>
                {race.groups.map((g: any) => <option key={g.id} value={g.id}>{g.name}</option>)}
              </select>
            </div>
          </div>
          <div className="form-row">
            <div className="field"><label>标题</label><input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
            <div className="field"><label>发生点位</label>
              <select value={form.routePointId} onChange={(e) => setForm({ ...form, routePointId: e.target.value })}>
                <option value="">—</option>
                {points.map((p: any) => <option key={p.id} value={p.id}>{p.name}（{POINT_TYPES[p.type]}）</option>)}
              </select>
            </div>
          </div>
          <div className="field"><label>描述</label><textarea rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
          <button className="btn primary" onClick={create} disabled={!form.title}>上报并通知相关岗位</button>
        </div>
      )}
      <table>
        <thead><tr><th>时间</th><th>类型</th><th>级别</th><th>标题</th><th>影响组别</th><th>状态</th><th>操作</th></tr></thead>
        <tbody>
          {events.map((e) => (
            <tr key={e.id}>
              <td className="small">{fmtTime(e.createdAt)}</td>
              <td>{EVENT_TYPES[e.type] || e.type}</td>
              <td><Badge color={SEVERITY[e.severity]?.[1]}>{SEVERITY[e.severity]?.[0]}</Badge></td>
              <td>{e.title}{e.description && <div className="small muted">{e.description}</div>}</td>
              <td>{e.group?.name || '全部'}</td>
              <td><Badge color={EVENT_STATUS[e.status]?.[1]}>{EVENT_STATUS[e.status]?.[0]}</Badge></td>
              <td>
                <div style={{ display: 'flex', gap: 4 }}>
                  {e.status === 'OPEN' && <button className="btn sm" onClick={() => setStatus(e.id, 'ACKNOWLEDGED')}>知晓</button>}
                  {e.status !== 'RESOLVED' && <button className="btn sm success" onClick={() => setStatus(e.id, 'RESOLVED')}>解决</button>}
                </div>
              </td>
            </tr>
          ))}
          {events.length === 0 && <tr><td colSpan={7} className="muted">暂无事件</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

function InstructionTab({ race, notify, setError }: any) {
  const [message, setMessage] = useState('');
  const [groupIds, setGroupIds] = useState<string[]>([]);
  const toggle = (id: string) => setGroupIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));
  const issue = async () => {
    try {
      const res = await api('instructions', { method: 'POST', body: { raceId: race.id, message, groupIds } });
      notify(`指令已发布并推送给选手（组别：${res.groups.join('、') || '全部'}），已进入统一时间轴`);
      setMessage(''); setGroupIds([]);
    } catch (e: any) { setError(e.message); }
  };
  return (
    <div>
      <div className="field"><label>指令内容（将进入统一时间轴，并作为选手通知推送）</label>
        <textarea rows={3} value={message} onChange={(e) => setMessage(e.target.value)} placeholder="如：因降雨，下坡段限速 30km/h，禁止超车" /></div>
      <div className="field">
        <label>影响组别（不选 = 全部组别）</label>
        <div className="checks">
          {race.groups.map((g: any) => (
            <label key={g.id} className={groupIds.includes(g.id) ? 'on' : ''}>
              <input type="checkbox" checked={groupIds.includes(g.id)} onChange={() => toggle(g.id)} /> {g.name}
            </label>
          ))}
        </div>
      </div>
      <button className="btn primary" onClick={issue} disabled={!message}>发布指令</button>
    </div>
  );
}

function AppealsTab({ race, notify, setError }: any) {
  const [appeals, setAppeals] = useState<any[]>([]);
  const load = () => api(`appeals/race/${race.id}`).then(setAppeals).catch((e) => setError(e.message));
  useEffect(() => { load(); }, [race.id]);
  const resolve = async (id: string, status: string) => {
    const resolution = prompt('处理意见') || '';
    try { await api(`appeals/${id}/resolve`, { method: 'POST', body: { status, resolution } }); notify('已处理'); load(); }
    catch (e: any) { setError(e.message); }
  };
  return (
    <table>
      <thead><tr><th>时间</th><th>号码</th><th>组别</th><th>类别</th><th>理由 / 证据</th><th>状态</th><th>操作</th></tr></thead>
      <tbody>
        {appeals.map((a) => (
          <tr key={a.id}>
            <td className="small">{fmtTime(a.createdAt)}</td>
            <td>{a.bibNumber}</td>
            <td>{a.groupName}</td>
            <td>{a.category}</td>
            <td className="small">{a.reason}{a.evidence && <div className="muted">证据：{a.evidence}</div>}
              {a.resolution && <div className="muted">处理：{a.resolution}</div>}</td>
            <td><Badge color={APPEAL_STATUS[a.status]?.[1]}>{APPEAL_STATUS[a.status]?.[0]}</Badge></td>
            <td>
              <div style={{ display: 'flex', gap: 4 }}>
                {a.status === 'SUBMITTED' && <button className="btn sm" onClick={() => resolve(a.id, 'UNDER_REVIEW')}>受理</button>}
                {!['UPHELD', 'REJECTED'].includes(a.status) && (
                  <>
                    <button className="btn sm success" onClick={() => resolve(a.id, 'UPHELD')}>成立</button>
                    <button className="btn sm danger" onClick={() => resolve(a.id, 'REJECTED')}>驳回</button>
                  </>
                )}
              </div>
            </td>
          </tr>
        ))}
        {appeals.length === 0 && <tr><td colSpan={7} className="muted">暂无申诉</td></tr>}
      </tbody>
    </table>
  );
}

// ---------------- 赛段缩短确认 / 关门核验 ----------------

function ShorteningTab({ race, notify, setError }: any) {
  const [list, setList] = useState<any[]>([]);
  const [pendingRiders, setPendingRiders] = useState<any[]>([]);
  const load = async () => {
    try {
      const [ss, rankings] = await Promise.all([
        api(`shortenings/race/${race.id}`),
        api(`results/race/${race.id}`),
      ]);
      setList(ss);
      const groups = rankings.groups || [];
      const riders: any[] = [];
      for (const g of groups) for (const r of g.others) if (r.resultRule === 'BEHIND_CUTOFF') riders.push({ ...r, groupName: g.group.name });
      setPendingRiders(riders);
    } catch (e: any) { setError(e.message); }
  };
  useEffect(() => { load(); }, [race.id]);

  const confirm = async (s: any) => {
    const note = prompt('确认备注（可选，如：按预案执行，10:50 生效）') || '';
    try {
      await api(`shortenings/${s.id}/confirm`, { method: 'POST', body: { note } });
      notify('已确认：关门时间已下发，任务已重生成');
      load();
    } catch (e: any) { setError(e.message); }
  };
  const markArrival = async (s: any, regId: string) => {
    try {
      const r = await api(`shortenings/${s.id}/verify-cutoff`, { method: 'POST', body: { registrationId: regId } });
      notify(`关门核验：通过 ${r.finalized} 人，超时 DNF ${r.missed} 人`);
      load();
    } catch (e: any) { setError(e.message); }
  };
  const closeAll = async (s: any) => {
    if (!confirm('将所有未在关门前通过新终点的选手记为 DNF，确定？')) return;
    try {
      const r = await api(`shortenings/${s.id}/verify-cutoff`, { method: 'POST', body: { markMissed: true } });
      notify(`已批量关门：DNF ${r.missed} 人`);
      load();
    } catch (e: any) { setError(e.message); }
  };

  if (!list.length) return <div className="muted">暂无赛段缩短方案。请运营在「天气应急」中录入预警并评估提交。</div>;

  return (
    <div>
      <ShorteningBanner raceId={race.id} />
      {list.map((s) => (
        <div className="card" key={s.id} style={{ background: s.status === 'CONFIRMED' ? '#fffafa' : '#fffdf5' }}>
          <h2>
            {WEATHER_KINDS[s.alert?.kind] || ''}缩短方案 · 新终点「{s.junction?.name}」（{s.junction?.kmMark}km）
            <Badge color={SHORTENING_STATUS[s.status]?.[1]}>{SHORTENING_STATUS[s.status]?.[0]}</Badge>
            {s.status === 'PROPOSED' && <button className="btn danger sm" style={{ marginLeft: 'auto' }} onClick={() => confirm(s)}>裁判确认生效</button>}
          </h2>
          <p className="small muted">提交：{fmtTime(s.proposedAt)}{s.confirmedAt && <> · 确认：{fmtTime(s.confirmedAt)}</>}</p>
          <table>
            <thead><tr><th>组别</th><th>新关门时间</th><th>已过关键路口</th><th>未通过（关门核验）</th></tr></thead>
            <tbody>
              {s.cutoffPlan.map((p: any) => (
                <tr key={p.groupId}>
                  <td>{p.groupName}</td>
                  <td><strong style={{ color: '#b00' }}>{p.cutoffTime}</strong></td>
                  <td>{p.ridersAhead} <span className="small muted">{p.aheadBibs?.join('、')}</span></td>
                  <td>{p.ridersBehind} <span className="small muted">{p.behindBibs?.join('、')}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="small muted">评估依据：{s.assessmentSummary}</p>
          {s.status === 'CONFIRMED' && (
            <>
              <h3>关门核验（未通过关键路口选手）</h3>
              {pendingRiders.length === 0 ? <div className="muted small">无待核验选手（均已关门前到达或已判 DNF）</div> : (
                <table>
                  <thead><tr><th>号码</th><th>组别</th><th>操作</th></tr></thead>
                  <tbody>
                    {pendingRiders.map((r) => (
                      <tr key={r.id}>
                        <td>{r.bibNumber}</td><td>{r.groupName}</td>
                        <td><button className="btn sm primary" onClick={() => markArrival(s, r.registrationId)}>登记此刻通过新终点</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              <p style={{ marginTop: 10 }}>
                <button className="btn sm danger" onClick={() => closeAll(s)}>批量关门：未到者记 DNF</button>
              </p>
            </>
          )}
        </div>
      ))}
      <div className="card">
        <h2>任务重生成与岗位签收</h2>
        <ShorteningTaskBoard raceId={race.id} canAck={true} onChange={load} />
      </div>
    </div>
  );
}

function TimingTab({ race, notify, setError }: any) {
  const [riders, setRiders] = useState<any[]>([]);
  const [regId, setRegId] = useState('');
  const [pointId, setPointId] = useState('');
  const [chips, setChips] = useState<any[]>([]);
  const points = (race.routes?.[0]?.points || []).filter((p: any) => ['START', 'TIMING', 'FINISH', 'SUPPLY', 'MEDICAL', 'TRAFFIC_CONTROL'].includes(p.type) && p.isActive !== false);

  useEffect(() => {
    api(`checkins/race/${race.id}`).then((list) => {
      setRiders(list.filter((r: any) => r.checkIn?.status === 'PASSED'));
    }).catch(() => {});
  }, [race.id]);
  useEffect(() => {
    if (regId) api(`results/chips/${regId}`).then(setChips).catch(() => setChips([]));
    else setChips([]);
  }, [regId]);

  const record = async () => {
    try {
      const res = await api('results/chips', { method: 'POST', body: { registrationId: regId, routePointId: pointId } });
      notify(res.result ? `芯片已录入，终点成绩：${res.result.netSeconds != null ? fmtSecondsLocal(res.result.netSeconds) : '-'}` : '芯片已录入');
      if (regId) setChips(await api(`results/chips/${regId}`));
    } catch (e: any) { setError(e.message); }
  };
  const simulate = async () => {
    try {
      const r = await api(`results/race/${race.id}/simulate`, { method: 'POST' });
      notify(`已为 ${r.created} 名选手生成模拟成绩`);
    } catch (e: any) { setError(e.message); }
  };
  const fmtSecondsLocal = (sec: number) => `${Math.floor(sec / 3600)}:${String(Math.floor((sec % 3600) / 60)).padStart(2, '0')}:${String(sec % 60).padStart(2, '0')}`;

  return (
    <div>
      <div className="grid2">
        <div>
          <h3>人工补录芯片（处理漏读）</h3>
          <div className="field"><label>选手（检录通过）</label>
            <select value={regId} onChange={(e) => setRegId(e.target.value)}>
              <option value="">— 选择 —</option>
              {riders.map((r) => <option key={r.id} value={r.id}>{r.bibNumber} · {r.rider?.displayName}</option>)}
            </select>
          </div>
          <div className="field"><label>计时点位</label>
            <select value={pointId} onChange={(e) => setPointId(e.target.value)}>
              <option value="">— 选择 —</option>
              {points.map((p: any) => <option key={p.id} value={p.id}>{p.name}（{POINT_TYPES[p.type]} · {p.kmMark}km）</option>)}
            </select>
          </div>
          <button className="btn primary" onClick={record} disabled={!regId || !pointId}>录入芯片记录</button>
          {race.status === 'RACE_DAY' && (
            <p className="small muted" style={{ marginTop: 10 }}>
              演示工具：<button className="btn sm" onClick={simulate}>一键生成全部模拟成绩</button>
            </p>
          )}
          {chips.length > 0 && (
            <>
              <h3 style={{ marginTop: 14 }}>该选手芯片记录</h3>
              <table>
                <thead><tr><th>点位</th><th>类型</th><th>时间</th><th>来源</th></tr></thead>
                <tbody>
                  {chips.map((c) => (
                    <tr key={c.id}><td>{c.point?.name}</td><td>{POINT_TYPES[c.point?.type] || ''}</td><td className="small">{fmtTime(c.readAt)}</td><td>{c.source}</td></tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </div>
        <div>
          <h3>成绩榜</h3>
          <ResultsView raceId={race.id} />
        </div>
      </div>
    </div>
  );
}
