'use client';

import { useEffect, useState } from 'react';
import Nav from '@/components/Nav';
import TimelineView from '@/components/TimelineView';
import ResultsView from '@/components/ResultsView';
import ArchiveView from '@/components/ArchiveView';
import { Badge, ErrorBox, OkBox, useRequireRole } from '@/components/ui';
import { api } from '@/lib/api';
import { POINT_TYPES, RACE_STATUS, REG_STATUS, RISK_LABELS, VEHICLE_TYPES, fmtTime } from '@/lib/labels';
import WeatherShorteningPanel from '@/components/WeatherShorteningPanel';
import ShorteningTaskBoard from '@/components/ShorteningTaskBoard';

const NEXT_STATUS: Record<string, string[]> = {
  DRAFT: ['REGISTRATION_OPEN'],
  REGISTRATION_OPEN: ['REGISTRATION_CLOSED'],
  REGISTRATION_CLOSED: ['RACE_DAY'],
  RACE_DAY: ['FINISHED'],
  FINISHED: ['ARCHIVED'],
  ARCHIVED: [],
};

export default function OpsPage() {
  const { ready } = useRequireRole('OPS');
  const [races, setRaces] = useState<any[]>([]);
  const [selected, setSelected] = useState<any>(null);
  const [tab, setTab] = useState('overview');
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');
  const [showCreate, setShowCreate] = useState(false);

  const load = async () => {
    const list = await api('races');
    setRaces(list);
    if (selected) {
      const fresh = await api(`races/${selected.id}`);
      setSelected(fresh);
    }
  };
  useEffect(() => { load().catch((e) => setError(e.message)); }, []);

  const open = async (r: any) => {
    setError(''); setOk('');
    const d = await api(`races/${r.id}`);
    setSelected(d);
    setTab('overview');
  };

  const refresh = async (msg?: string) => {
    if (msg) setOk(msg);
    const d = await api(`races/${selected.id}`);
    setSelected(d);
    const list = await api('races');
    setRaces(list);
  };

  if (!ready) return null;

  return (
    <div>
      <Nav />
      <div className="container">
        <ErrorBox error={error} /><OkBox message={ok} />
        {!selected ? (
          <>
            <div className="card">
              <h2>
                赛事管理
                <button className="btn primary sm" style={{ marginLeft: 'auto' }} onClick={() => setShowCreate(!showCreate)}>
                  {showCreate ? '收起' : '+ 新建赛事'}
                </button>
              </h2>
              {showCreate && <CreateRace onCreated={(r) => { setShowCreate(false); open(r); }} />}
              <table>
                <thead><tr><th>赛事</th><th>日期</th><th>地点</th><th>状态</th><th>组别</th><th>报名</th><th></th></tr></thead>
                <tbody>
                  {races.map((r) => (
                    <tr key={r.id}>
                      <td>{r.name}</td><td>{r.raceDate}</td><td>{r.location}</td>
                      <td><Badge color={RACE_STATUS[r.status]?.[1]}>{RACE_STATUS[r.status]?.[0]}</Badge></td>
                      <td>{r.groupCount}</td><td>{r.registrationCount}</td>
                      <td><button className="btn sm primary" onClick={() => open(r)}>管理</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <>
            <div className="card">
              <h2>
                {selected.name} <Badge color={RACE_STATUS[selected.status]?.[1]}>{RACE_STATUS[selected.status]?.[0]}</Badge>
                <button className="btn sm" style={{ marginLeft: 'auto' }} onClick={() => setSelected(null)}>← 返回列表</button>
              </h2>
              <span className="muted small">{selected.raceDate} · {selected.location} · {selected.description}</span>
            </div>
            <div className="tabs">
              {[['overview', '概览/状态'], ['groups', '组别规则'], ['route', '路线与点位'], ['regs', '报名审核'], ['weather', '天气应急·缩短'], ['results', '成绩'], ['timeline', '时间轴'], ['archive', '赛事档案']].map(([k, l]) => (
                <button key={k} className={tab === k ? 'active' : ''} onClick={() => setTab(k)}>{l}</button>
              ))}
            </div>
            {tab === 'overview' && <Overview race={selected} refresh={refresh} setError={setError} />}
            {tab === 'groups' && <Groups race={selected} refresh={refresh} setError={setError} />}
            {tab === 'route' && <RouteEditor race={selected} refresh={refresh} setError={setError} />}
            {tab === 'regs' && <RegReview race={selected} refresh={refresh} setError={setError} />}
            {tab === 'weather' && (
              <div>
                <WeatherShorteningPanel race={selected} onChange={() => refresh()} />
                <div className="card">
                  <h2>缩短任务与岗位签收看板</h2>
                  <ShorteningTaskBoard raceId={selected.id} canAck={true} onChange={() => refresh()} />
                </div>
              </div>
            )}
            {tab === 'results' && <div className="card"><h2>成绩榜（颁奖依据）</h2><SimulateButton race={selected} refresh={refresh} setError={setError} /><ResultsView raceId={selected.id} /></div>}
            {tab === 'timeline' && <div className="card"><h2>统一时间轴</h2><TimelineView raceId={selected.id} groups={selected.groups} /></div>}
            {tab === 'archive' && <ArchiveView raceId={selected.id} />}
          </>
        )}
      </div>
    </div>
  );
}

function CreateRace({ onCreated }: { onCreated: (r: any) => void }) {
  const [form, setForm] = useState({ name: '', raceDate: '', location: '', description: '' });
  const [error, setError] = useState('');
  const submit = async () => {
    try {
      const r = await api('races', { method: 'POST', body: form });
      onCreated(r);
    } catch (e: any) { setError(e.message); }
  };
  return (
    <div style={{ border: '1px dashed var(--border)', borderRadius: 8, padding: 14, marginBottom: 14 }}>
      <ErrorBox error={error} />
      <div className="form-row">
        <div className="field"><label>赛事名称</label><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
        <div className="field"><label>比赛日期</label><input type="date" value={form.raceDate} onChange={(e) => setForm({ ...form, raceDate: e.target.value })} /></div>
      </div>
      <div className="form-row">
        <div className="field"><label>地点</label><input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} /></div>
        <div className="field"><label>简介</label><input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
      </div>
      <button className="btn primary" onClick={submit} disabled={!form.name || !form.raceDate}>创建（草稿）</button>
    </div>
  );
}

function Overview({ race, refresh, setError }: any) {
  const transition = async (status: string) => {
    setError('');
    try { await api(`races/${race.id}/status`, { method: 'POST', body: { status } }); await refresh('状态已更新'); }
    catch (e: any) { setError(e.message); }
  };
  const next = NEXT_STATUS[race.status] || [];
  return (
    <div>
      <div className="grid4">
        <div className="stat"><div className="num">{race.groups.length}</div><div className="lbl">组别</div></div>
        <div className="stat"><div className="num">{race.groups.reduce((s: number, g: any) => s + g.approvedCount, 0)}</div><div className="lbl">已通过报名</div></div>
        <div className="stat"><div className="num">{race.groups.reduce((s: number, g: any) => s + g.waitlistedCount, 0)}</div><div className="lbl">候补</div></div>
        <div className="stat"><div className="num">{race.routes.filter((r: any) => r.status === 'CONFIRMED').length}</div><div className="lbl">已确认路线</div></div>
      </div>
      <div className="card" style={{ marginTop: 18 }}>
        <h2>状态流转</h2>
        <p className="muted small">流程：草稿 → 开放报名 → 报名截止 → 比赛日（需先确认路线）→ 已完赛 → 已归档</p>
        <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
          {next.length === 0 && <span className="muted">已是最终状态</span>}
          {next.map((s) => (
            <button key={s} className="btn primary" onClick={() => transition(s)}>
              流转到「{RACE_STATUS[s]?.[0]}」
            </button>
          ))}
        </div>
      </div>
      <div className="card">
        <h2>组别报名情况</h2>
        <table>
          <thead><tr><th>组别</th><th>名额</th><th>已通过</th><th>候补</th><th>发车时间</th></tr></thead>
          <tbody>
            {race.groups.map((g: any) => (
              <tr key={g.id}><td>{g.name}</td><td>{g.capacity}</td><td>{g.approvedCount}</td><td>{g.waitlistedCount}</td><td>{g.startTime}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const EMPTY_GROUP = { name: '', code: '', minAge: 16, maxAge: 65, allowedVehicleTypes: ['ROAD'], minExperienceYears: 0, capacity: 100, requiresInsurance: true, maxMedicalRisk: 'MEDIUM', startTime: '08:00', sortOrder: 0 };

function Groups({ race, refresh, setError }: any) {
  const [form, setForm] = useState<any>(EMPTY_GROUP);
  const editable = ['DRAFT', 'REGISTRATION_OPEN'].includes(race.status);
  const toggleVehicle = (v: string) => {
    setForm((f: any) => ({
      ...f,
      allowedVehicleTypes: f.allowedVehicleTypes.includes(v) ? f.allowedVehicleTypes.filter((x: string) => x !== v) : [...f.allowedVehicleTypes, v],
    }));
  };
  const submit = async () => {
    setError('');
    try {
      await api(`races/${race.id}/groups`, { method: 'POST', body: { ...form, minAge: +form.minAge, maxAge: +form.maxAge, minExperienceYears: +form.minExperienceYears, capacity: +form.capacity, sortOrder: +form.sortOrder } });
      setForm(EMPTY_GROUP);
      await refresh('组别已添加');
    } catch (e: any) { setError(e.message); }
  };
  return (
    <div>
      <div className="card">
        <h2>组别规则（年龄 / 车辆 / 经验 / 人数上限 / 保险 / 医疗风险上限）</h2>
        <table>
          <thead><tr><th>组别</th><th>代码</th><th>年龄</th><th>车辆</th><th>经验</th><th>上限</th><th>保险</th><th>风险上限</th><th>发车</th></tr></thead>
          <tbody>
            {race.groups.map((g: any) => (
              <tr key={g.id}>
                <td>{g.name}</td><td>{g.code}</td><td>{g.minAge}-{g.maxAge}</td>
                <td className="small">{g.allowedVehicleTypes.map((v: string) => VEHICLE_TYPES[v] || v).join('/')}</td>
                <td>≥{g.minExperienceYears}年</td><td>{g.capacity}</td>
                <td>{g.requiresInsurance ? '必须' : '否'}</td>
                <td><Badge color={RISK_LABELS[g.maxMedicalRisk]?.[1]}>{RISK_LABELS[g.maxMedicalRisk]?.[0]}</Badge></td>
                <td>{g.startTime}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {editable && (
        <div className="card">
          <h2>新增组别</h2>
          <div className="form-row3">
            <div className="field"><label>名称</label><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div className="field"><label>代码（号码前缀）</label><input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} /></div>
            <div className="field"><label>发车时间</label><input value={form.startTime} onChange={(e) => setForm({ ...form, startTime: e.target.value })} placeholder="08:00" /></div>
          </div>
          <div className="form-row3">
            <div className="field"><label>最小年龄</label><input type="number" value={form.minAge} onChange={(e) => setForm({ ...form, minAge: e.target.value })} /></div>
            <div className="field"><label>最大年龄</label><input type="number" value={form.maxAge} onChange={(e) => setForm({ ...form, maxAge: e.target.value })} /></div>
            <div className="field"><label>最少经验（年）</label><input type="number" value={form.minExperienceYears} onChange={(e) => setForm({ ...form, minExperienceYears: e.target.value })} /></div>
          </div>
          <div className="form-row3">
            <div className="field"><label>人数上限</label><input type="number" value={form.capacity} onChange={(e) => setForm({ ...form, capacity: e.target.value })} /></div>
            <div className="field"><label>医疗风险上限</label>
              <select value={form.maxMedicalRisk} onChange={(e) => setForm({ ...form, maxMedicalRisk: e.target.value })}>
                <option value="LOW">低</option><option value="MEDIUM">中</option><option value="HIGH">高</option>
              </select>
            </div>
            <div className="field"><label>排序</label><input type="number" value={form.sortOrder} onChange={(e) => setForm({ ...form, sortOrder: e.target.value })} /></div>
          </div>
          <div className="field">
            <label>允许车辆类型</label>
            <div className="checks">
              {Object.entries(VEHICLE_TYPES).map(([k, v]) => (
                <label key={k} className={form.allowedVehicleTypes.includes(k) ? 'on' : ''}>
                  <input type="checkbox" checked={form.allowedVehicleTypes.includes(k)} onChange={() => toggleVehicle(k)} /> {v}
                </label>
              ))}
            </div>
          </div>
          <div className="checks" style={{ gridTemplateColumns: '1fr' }}>
            <label className={form.requiresInsurance ? 'on' : ''}>
              <input type="checkbox" checked={form.requiresInsurance} onChange={(e) => setForm({ ...form, requiresInsurance: e.target.checked })} /> 必须提供有效保险
            </label>
          </div>
          <button className="btn primary" onClick={submit} disabled={!form.name || !form.code || !form.allowedVehicleTypes.length}>添加组别</button>
        </div>
      )}
    </div>
  );
}

const EMPTY_POINT = { type: 'SUPPLY', name: '', kmMark: 0, sequence: 0, description: '', trafficControlStart: '', trafficControlEnd: '', waterStock: 0, gelStock: 0, partsStock: 0, medicalCapacity: 0, staffed: true, groupIds: [] as string[] };

function RouteEditor({ race, refresh, setError }: any) {
  const [routeForm, setRouteForm] = useState<any>({ name: '', distanceKm: 0, notes: '' });
  const [pointForm, setPointForm] = useState<any>(EMPTY_POINT);
  const route = race.routes[0];

  const createRoute = async () => {
    try {
      await api(`races/${race.id}/routes`, { method: 'POST', body: { ...routeForm, distanceKm: +routeForm.distanceKm } });
      await refresh('路线已创建（草稿）');
    } catch (e: any) { setError(e.message); }
  };
  const addPoint = async () => {
    try {
      await api(`races/${route.id}/points`, {
        method: 'POST',
        body: { ...pointForm, kmMark: +pointForm.kmMark, sequence: +pointForm.sequence, waterStock: +pointForm.waterStock, gelStock: +pointForm.gelStock, partsStock: +pointForm.partsStock, medicalCapacity: +pointForm.medicalCapacity },
      });
      setPointForm(EMPTY_POINT);
      await refresh('点位已添加');
    } catch (e: any) { setError(e.message); }
  };
  const confirm = async () => {
    try { await api(`races/routes/${route.id}/confirm`, { method: 'POST' }); await refresh('路线已确认，点位与组别关联已锁定'); }
    catch (e: any) { setError(e.message); }
  };
  const delPoint = async (pid: string) => {
    try { await api(`races/points/${pid}`, { method: 'DELETE' }); await refresh('点位已删除'); }
    catch (e: any) { setError(e.message); }
  };
  const togglePointGroup = (v: string) => {
    setPointForm((f: any) => ({ ...f, groupIds: f.groupIds.includes(v) ? f.groupIds.filter((x: string) => x !== v) : [...f.groupIds, v] }));
  };

  if (!route) {
    return (
      <div className="card">
        <h2>创建路线</h2>
        <div className="form-row3">
          <div className="field"><label>路线名称</label><input value={routeForm.name} onChange={(e) => setRouteForm({ ...routeForm, name: e.target.value })} /></div>
          <div className="field"><label>距离（km）</label><input type="number" value={routeForm.distanceKm} onChange={(e) => setRouteForm({ ...routeForm, distanceKm: e.target.value })} /></div>
          <div className="field"><label>备注</label><input value={routeForm.notes} onChange={(e) => setRouteForm({ ...routeForm, notes: e.target.value })} /></div>
        </div>
        <button className="btn primary" onClick={createRoute} disabled={!routeForm.name}>创建路线</button>
      </div>
    );
  }

  const editable = route.status === 'DRAFT';
  const groupName = (id: string) => race.groups.find((g: any) => g.id === id)?.name || id;

  return (
    <div>
      <div className="card">
        <h2>
          {route.name}（{route.distanceKm}km）
          <Badge color={route.status === 'CONFIRMED' ? 'green' : 'gray'}>{route.status === 'CONFIRMED' ? '已确认' : '草稿'}</Badge>
          {editable && <button className="btn primary sm" style={{ marginLeft: 'auto' }} onClick={confirm}>确认路线</button>}
        </h2>
        {route.confirmedAt && <p className="muted small">确认时间：{fmtTime(route.confirmedAt)}</p>}
        {route.points.map((p: any) => (
          <div className="point-row" key={p.id} style={p.isActive === false ? { opacity: 0.5 } : undefined}>
            <div className="km">{p.kmMark}km</div>
            <div className="grow">
              <strong>{p.name}</strong> <Badge color="blue">{POINT_TYPES[p.type]}</Badge>{' '}
              {p.isActive === false && <Badge color="gray">路段撤销</Badge>}
              {p.cutoffTime && <Badge color="red">关门 {p.cutoffTime}</Badge>}
              {p.staffed === false && <Badge color="red">无人值守</Badge>}
              {p.trafficControlStart && <span className="small muted">管制 {p.trafficControlStart}-{p.trafficControlEnd}</span>}
              {p.description && <div className="small muted">{p.description}</div>}
              <div className="small muted">
                {p.type === 'SUPPLY' && `库存：饮水 ${p.waterStock} / 能量胶 ${p.gelStock}　`}
                {p.type === 'REPAIR' && `配件库存：${p.partsStock}　`}
                {p.type === 'MEDICAL' && `医疗容量：${p.medicalCapacity || '不限'}　`}
                关联组别：{p.groupIds?.length ? p.groupIds.map(groupName).join('、') : '全部组别'}
              </div>
            </div>
            {editable && <button className="btn sm danger" onClick={() => delPoint(p.id)}>删除</button>}
          </div>
        ))}
      </div>
      {editable && (
        <div className="card">
          <h2>添加点位（起终点 / 爬坡段 / 补给 / 维修 / 医疗 / 计时 / 交通管制）</h2>
          <div className="form-row3">
            <div className="field"><label>类型</label>
              <select value={pointForm.type} onChange={(e) => setPointForm({ ...pointForm, type: e.target.value })}>
                {Object.entries(POINT_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div className="field"><label>名称</label><input value={pointForm.name} onChange={(e) => setPointForm({ ...pointForm, name: e.target.value })} /></div>
            <div className="field"><label>公里数</label><input type="number" step="0.1" value={pointForm.kmMark} onChange={(e) => setPointForm({ ...pointForm, kmMark: e.target.value })} /></div>
          </div>
          <div className="form-row3">
            <div className="field"><label>顺序</label><input type="number" value={pointForm.sequence} onChange={(e) => setPointForm({ ...pointForm, sequence: e.target.value })} /></div>
            <div className="field"><label>交通管制开始</label><input value={pointForm.trafficControlStart} onChange={(e) => setPointForm({ ...pointForm, trafficControlStart: e.target.value })} placeholder="07:30" /></div>
            <div className="field"><label>交通管制结束</label><input value={pointForm.trafficControlEnd} onChange={(e) => setPointForm({ ...pointForm, trafficControlEnd: e.target.value })} placeholder="11:00" /></div>
          </div>
          {pointForm.type === 'SUPPLY' && (
            <div className="form-row3">
              <div className="field"><label>饮水库存</label><input type="number" value={pointForm.waterStock} onChange={(e) => setPointForm({ ...pointForm, waterStock: e.target.value })} /></div>
              <div className="field"><label>能量胶库存</label><input type="number" value={pointForm.gelStock} onChange={(e) => setPointForm({ ...pointForm, gelStock: e.target.value })} /></div>
              <div className="field" />
            </div>
          )}
          {pointForm.type === 'REPAIR' && (
            <div className="form-row3">
              <div className="field"><label>维修配件库存</label><input type="number" value={pointForm.partsStock} onChange={(e) => setPointForm({ ...pointForm, partsStock: e.target.value })} /></div>
            </div>
          )}
          {pointForm.type === 'MEDICAL' && (
            <div className="form-row3">
              <div className="field"><label>医疗容量（可同时处置人数）</label><input type="number" value={pointForm.medicalCapacity} onChange={(e) => setPointForm({ ...pointForm, medicalCapacity: e.target.value })} /></div>
            </div>
          )}
          <div className="checks" style={{ gridTemplateColumns: '1fr' }}>
            <label className={pointForm.staffed ? 'on' : ''}>
              <input type="checkbox" checked={!!pointForm.staffed} onChange={(e) => setPointForm({ ...pointForm, staffed: e.target.checked })} /> 比赛日有岗位人员在岗（取消勾选=无人值守点位，缩短时将被标记为"未接到通知岗位"）
            </label>
          </div>
          <div className="field"><label>说明</label><input value={pointForm.description} onChange={(e) => setPointForm({ ...pointForm, description: e.target.value })} /></div>
          <div className="field">
            <label>关联组别（不选 = 全部组别适用）</label>
            <div className="checks">
              {race.groups.map((g: any) => (
                <label key={g.id} className={pointForm.groupIds.includes(g.id) ? 'on' : ''}>
                  <input type="checkbox" checked={pointForm.groupIds.includes(g.id)} onChange={() => togglePointGroup(g.id)} /> {g.name}
                </label>
              ))}
            </div>
          </div>
          <button className="btn primary" onClick={addPoint} disabled={!pointForm.name}>添加点位</button>
        </div>
      )}
    </div>
  );
}

function RegReview({ race, refresh, setError }: any) {
  const [regs, setRegs] = useState<any[]>([]);
  const [filter, setFilter] = useState('');
  const load = () => api(`races/${race.id}/registrations`).then(setRegs).catch((e) => setError(e.message));
  useEffect(() => { load(); }, [race.id]);

  const review = async (id: string, action: string) => {
    const note = action === 'reject' ? prompt('拒绝原因（可选）') || '' : prompt('审核备注（可选）') || '';
    try { await api(`registrations/${id}/review`, { method: 'POST', body: { action, note } }); await load(); await refresh('审核完成'); }
    catch (e: any) { setError(e.message); }
  };

  const shown = filter ? regs.filter((r) => r.status === filter) : regs;
  return (
    <div className="card">
      <h2>
        报名审核（系统已自动判定，可人工覆盖）
        <select style={{ width: 160, marginLeft: 'auto' }} value={filter} onChange={(e) => setFilter(e.target.value)}>
          <option value="">全部状态</option>
          {Object.entries(REG_STATUS).map(([k, [l]]) => <option key={k} value={k}>{l}</option>)}
        </select>
      </h2>
      <table>
        <thead><tr><th>选手</th><th>组别</th><th>系统判定</th><th>原因</th><th>医疗风险</th><th>号码</th><th>操作</th></tr></thead>
        <tbody>
          {shown.map((r) => (
            <tr key={r.id}>
              <td>{r.rider?.displayName}</td>
              <td>{r.group?.name}</td>
              <td><Badge color={REG_STATUS[r.status]?.[1]}>{REG_STATUS[r.status]?.[0]}</Badge></td>
              <td className="small">{r.decisionReason}{r.reviewNote && <div className="muted">备注：{r.reviewNote}</div>}</td>
              <td><Badge color={RISK_LABELS[r.medicalRisk]?.[1]}>{RISK_LABELS[r.medicalRisk]?.[0]}</Badge></td>
              <td>{r.bibNumber || '—'}</td>
              <td>
                <div style={{ display: 'flex', gap: 6 }}>
                  {r.status !== 'APPROVED' && <button className="btn sm success" onClick={() => review(r.id, 'approve')}>通过</button>}
                  {r.status !== 'REJECTED' && <button className="btn sm danger" onClick={() => review(r.id, 'reject')}>拒绝</button>}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SimulateButton({ race, refresh, setError }: any) {
  if (race.status !== 'RACE_DAY') return null;
  const run = async () => {
    try {
      const r = await api(`results/race/${race.id}/simulate`, { method: 'POST' });
      await refresh(`已为 ${r.created} 名检录通过选手生成模拟成绩`);
    } catch (e: any) { setError(e.message); }
  };
  return (
    <p className="small muted" style={{ marginBottom: 10 }}>
      演示工具：<button className="btn sm" onClick={run}>为检录通过选手生成模拟芯片与成绩</button>
    </p>
  );
}
