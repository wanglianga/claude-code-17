'use client';

import { useEffect, useState } from 'react';
import Nav from '@/components/Nav';
import { Badge, ErrorBox, OkBox, useRequireRole } from '@/components/ui';
import { api } from '@/lib/api';
import { RACE_STATUS, REG_STATUS, RISK_LABELS, VEHICLE_TYPES, fmtTime } from '@/lib/labels';

const EMPTY_PROFILE = {
  fullName: '', gender: 'M', birthDate: '', idType: '身份证', idNumber: '', phone: '',
  experienceYears: 0, vehicleType: 'ROAD', emergencyContactName: '', emergencyContactPhone: '',
  healthCommitment: false, healthConditions: '', historicalResults: '',
  insuranceProvider: '', insurancePolicyNo: '', insuranceValidUntil: '',
};

export default function RiderPage() {
  const { user, ready } = useRequireRole('RIDER');
  const [tab, setTab] = useState('races');
  if (!ready) return null;
  return (
    <div>
      <Nav />
      <div className="container">
        <div className="tabs">
          {[['races', '报名赛事'], ['mine', '我的报名'], ['profile', '我的资料'], ['notices', '选手通知']].map(([k, l]) => (
            <button key={k} className={tab === k ? 'active' : ''} onClick={() => setTab(k)}>{l}</button>
          ))}
        </div>
        {tab === 'profile' && <ProfileTab />}
        {tab === 'races' && <RacesTab />}
        {tab === 'mine' && <MineTab />}
        {tab === 'notices' && <NoticesTab />}
      </div>
    </div>
  );
}

function ProfileTab() {
  const [form, setForm] = useState<any>(EMPTY_PROFILE);
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');
  useEffect(() => {
    api('profile').then((p) => p && setForm({ ...EMPTY_PROFILE, ...p })).catch(() => {});
  }, []);
  const set = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }));
  const save = async () => {
    setError(''); setOk('');
    try {
      await api('profile', { method: 'PUT', body: { ...form, experienceYears: Number(form.experienceYears) } });
      setOk('资料已保存，可用于报名');
    } catch (e: any) { setError(e.message); }
  };
  return (
    <div className="card">
      <h2>选手资料（报名前请完善：证件 / 健康承诺 / 紧急联系人 / 保险）</h2>
      <ErrorBox error={error} /><OkBox message={ok} />
      <div className="form-row3">
        <div className="field"><label>姓名</label><input value={form.fullName} onChange={(e) => set('fullName', e.target.value)} /></div>
        <div className="field"><label>性别</label>
          <select value={form.gender} onChange={(e) => set('gender', e.target.value)}>
            <option value="M">男</option><option value="F">女</option>
          </select>
        </div>
        <div className="field"><label>出生日期</label><input type="date" value={form.birthDate} onChange={(e) => set('birthDate', e.target.value)} /></div>
      </div>
      <div className="form-row3">
        <div className="field"><label>证件类型</label>
          <select value={form.idType} onChange={(e) => set('idType', e.target.value)}>
            <option>身份证</option><option>护照</option><option>港澳台通行证</option>
          </select>
        </div>
        <div className="field"><label>证件号码</label><input value={form.idNumber} onChange={(e) => set('idNumber', e.target.value)} /></div>
        <div className="field"><label>联系电话</label><input value={form.phone} onChange={(e) => set('phone', e.target.value)} /></div>
      </div>
      <div className="form-row3">
        <div className="field"><label>骑行经验（年）</label><input type="number" min="0" value={form.experienceYears} onChange={(e) => set('experienceYears', e.target.value)} /></div>
        <div className="field"><label>车辆类型</label>
          <select value={form.vehicleType} onChange={(e) => set('vehicleType', e.target.value)}>
            {Object.entries(VEHICLE_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
        <div className="field"><label>历史成绩</label><input value={form.historicalResults} onChange={(e) => set('historicalResults', e.target.value)} placeholder="如：2025 环湖赛第 8 名" /></div>
      </div>
      <div className="form-row">
        <div className="field"><label>紧急联系人</label><input value={form.emergencyContactName} onChange={(e) => set('emergencyContactName', e.target.value)} /></div>
        <div className="field"><label>紧急联系人电话</label><input value={form.emergencyContactPhone} onChange={(e) => set('emergencyContactPhone', e.target.value)} /></div>
      </div>
      <div className="form-row3">
        <div className="field"><label>保险公司</label><input value={form.insuranceProvider} onChange={(e) => set('insuranceProvider', e.target.value)} /></div>
        <div className="field"><label>保单号</label><input value={form.insurancePolicyNo} onChange={(e) => set('insurancePolicyNo', e.target.value)} /></div>
        <div className="field"><label>保险有效期至</label><input type="date" value={form.insuranceValidUntil} onChange={(e) => set('insuranceValidUntil', e.target.value)} /></div>
      </div>
      <div className="field">
        <label>健康申报（既往病史，无则留空）</label>
        <textarea rows={2} value={form.healthConditions} onChange={(e) => set('healthConditions', e.target.value)} placeholder="如：高血压、哮喘…（将影响医疗风险评估）" />
      </div>
      <div className="checks" style={{ gridTemplateColumns: '1fr' }}>
        <label className={form.healthCommitment ? 'on' : ''}>
          <input type="checkbox" checked={!!form.healthCommitment} onChange={(e) => set('healthCommitment', e.target.checked)} />
          我签署健康承诺：确认身体状况适合参加高强度骑行赛事，如有隐瞒自行承担责任
        </label>
      </div>
      <button className="btn primary" onClick={save}>保存资料</button>
    </div>
  );
}

function RacesTab() {
  const [races, setRaces] = useState<any[]>([]);
  const [detail, setDetail] = useState<any>(null);
  const [groupId, setGroupId] = useState('');
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');

  const load = () => api('races').then(setRaces).catch((e) => setError(e.message));
  useEffect(() => { load(); }, []);

  const open = async (r: any) => {
    setError(''); setOk('');
    try {
      const d = await api(`races/${r.id}`);
      setDetail(d);
      setGroupId(d.groups[0]?.id || '');
    } catch (e: any) { setError(e.message); }
  };

  const submit = async () => {
    setError(''); setOk('');
    try {
      const reg = await api('registrations', { method: 'POST', body: { raceId: detail.id, groupId } });
      setOk(`报名结果：${REG_STATUS[reg.status]?.[0] || reg.status} — ${reg.decisionReason}`);
      setDetail(null);
      load();
    } catch (e: any) { setError(e.message); }
  };

  return (
    <div>
      <ErrorBox error={error} /><OkBox message={ok} />
      {detail ? (
        <div className="card">
          <h2>{detail.name} <Badge color={RACE_STATUS[detail.status]?.[1]}>{RACE_STATUS[detail.status]?.[0]}</Badge></h2>
          <p className="muted small">{detail.raceDate} · {detail.location} · {detail.description}</p>
          <h3>选择组别（系统将根据组别规则 / 人数上限 / 保险要求 / 医疗风险自动生成报名状态）</h3>
          <table>
            <thead><tr><th></th><th>组别</th><th>年龄</th><th>车辆</th><th>经验</th><th>名额</th><th>保险</th><th>医疗风险上限</th><th>发车</th></tr></thead>
            <tbody>
              {detail.groups.map((g: any) => (
                <tr key={g.id}>
                  <td><input type="radio" name="grp" checked={groupId === g.id} onChange={() => setGroupId(g.id)} style={{ width: 'auto' }} /></td>
                  <td>{g.name}</td>
                  <td>{g.minAge}-{g.maxAge} 岁</td>
                  <td className="small">{g.allowedVehicleTypes.map((v: string) => VEHICLE_TYPES[v] || v).join('/')}</td>
                  <td>≥{g.minExperienceYears} 年</td>
                  <td>{g.approvedCount}/{g.capacity}{g.waitlistedCount > 0 && <span className="muted small">（候补 {g.waitlistedCount}）</span>}</td>
                  <td>{g.requiresInsurance ? '必须' : '不强制'}</td>
                  <td><Badge color={RISK_LABELS[g.maxMedicalRisk]?.[1]}>{RISK_LABELS[g.maxMedicalRisk]?.[0]}</Badge></td>
                  <td>{g.startTime}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ marginTop: 14, display: 'flex', gap: 8 }}>
            <button className="btn primary" onClick={submit} disabled={detail.status !== 'REGISTRATION_OPEN'}>提交报名</button>
            <button className="btn" onClick={() => setDetail(null)}>返回</button>
            {detail.status !== 'REGISTRATION_OPEN' && <span className="muted small">当前不在报名期</span>}
          </div>
        </div>
      ) : (
        <div className="card">
          <h2>赛事列表</h2>
          <table>
            <thead><tr><th>赛事</th><th>日期</th><th>地点</th><th>状态</th><th>组别</th><th>报名数</th><th></th></tr></thead>
            <tbody>
              {races.map((r) => (
                <tr key={r.id}>
                  <td>{r.name}</td>
                  <td>{r.raceDate}</td>
                  <td>{r.location}</td>
                  <td><Badge color={RACE_STATUS[r.status]?.[1]}>{RACE_STATUS[r.status]?.[0]}</Badge></td>
                  <td>{r.groupCount}</td>
                  <td>{r.registrationCount}</td>
                  <td><button className="btn sm" onClick={() => open(r)}>查看/报名</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function MineTab() {
  const [regs, setRegs] = useState<any[]>([]);
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');
  const [appealFor, setAppealFor] = useState<any>(null);
  const [withdrawFor, setWithdrawFor] = useState<any>(null);

  const load = () => api('registrations/mine').then(setRegs).catch((e) => setError(e.message));
  useEffect(() => { load(); }, []);

  const cancel = async (id: string) => {
    if (!confirm('确定取消报名？')) return;
    try { await api(`registrations/${id}/cancel`, { method: 'POST' }); setOk('已取消'); load(); }
    catch (e: any) { setError(e.message); }
  };

  return (
    <div>
      <ErrorBox error={error} /><OkBox message={ok} />
      <div className="card">
        <h2>我的报名</h2>
        {regs.length === 0 ? <div className="muted">还没有报名记录</div> : (
          <table>
            <thead><tr><th>赛事</th><th>组别</th><th>状态</th><th>号码/芯片</th><th>医疗风险</th><th>说明</th><th>操作</th></tr></thead>
            <tbody>
              {regs.map((r) => (
                <tr key={r.id}>
                  <td>{r.race?.name}<div className="small muted">{r.race?.raceDate}</div></td>
                  <td>{r.group?.name}</td>
                  <td><Badge color={REG_STATUS[r.status]?.[1]}>{REG_STATUS[r.status]?.[0]}</Badge></td>
                  <td>{r.bibNumber ? <>{r.bibNumber}<div className="small muted">{r.chipId}</div></> : '—'}</td>
                  <td><Badge color={RISK_LABELS[r.medicalRisk]?.[1]}>{RISK_LABELS[r.medicalRisk]?.[0]}</Badge></td>
                  <td className="small">{r.decisionReason}{r.reviewNote && <div className="muted">审核备注：{r.reviewNote}</div>}</td>
                  <td>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {['APPROVED', 'WAITLISTED', 'PENDING_REVIEW'].includes(r.status) && !['FINISHED', 'ARCHIVED'].includes(r.race?.status) && (
                        <button className="btn sm danger" onClick={() => cancel(r.id)}>取消</button>
                      )}
                      {r.status === 'APPROVED' && r.race?.status === 'RACE_DAY' && (
                        <button className="btn sm" onClick={() => setWithdrawFor(r)}>退赛登记</button>
                      )}
                      {['FINISHED', 'ARCHIVED', 'RACE_DAY'].includes(r.race?.status) && (
                        <button className="btn sm" onClick={() => setAppealFor(r)}>申诉</button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      {appealFor && <AppealForm reg={appealFor} onClose={(done) => { setAppealFor(null); if (done) setOk('申诉已提交'); }} />}
      {withdrawFor && <WithdrawForm reg={withdrawFor} onClose={(done) => { setWithdrawFor(null); if (done) { setOk('退赛已登记'); load(); } }} />}
    </div>
  );
}

function AppealForm({ reg, onClose }: { reg: any; onClose: (done: boolean) => void }) {
  const [category, setCategory] = useState('RESULT');
  const [reason, setReason] = useState('');
  const [evidence, setEvidence] = useState('');
  const [error, setError] = useState('');
  const submit = async () => {
    try {
      await api('appeals', { method: 'POST', body: { raceId: reg.raceId, registrationId: reg.id, category, reason, evidence } });
      onClose(true);
    } catch (e: any) { setError(e.message); }
  };
  return (
    <div className="card">
      <h2>提交申诉 — {reg.race?.name} / {reg.group?.name}</h2>
      <ErrorBox error={error} />
      <div className="form-row">
        <div className="field"><label>申诉类别</label>
          <select value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="RESULT">成绩异议</option><option value="PENALTY">判罚异议</option>
            <option value="SAFETY">安全问题</option><option value="OTHER">其他</option>
          </select>
        </div>
        <div className="field"><label>申诉理由</label><input value={reason} onChange={(e) => setReason(e.target.value)} /></div>
      </div>
      <div className="field"><label>证据（描述 / 链接 / 照片说明）</label>
        <textarea rows={2} value={evidence} onChange={(e) => setEvidence(e.target.value)} /></div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button className="btn primary" onClick={submit} disabled={!reason}>提交申诉</button>
        <button className="btn" onClick={() => onClose(false)}>取消</button>
      </div>
    </div>
  );
}

function WithdrawForm({ reg, onClose }: { reg: any; onClose: (done: boolean) => void }) {
  const [points, setPoints] = useState<any[]>([]);
  const [routePointId, setRoutePointId] = useState('');
  const [kmMark, setKmMark] = useState('');
  const [reason, setReason] = useState('');
  const [needsShuttle, setNeedsShuttle] = useState(false);
  const [vehicleStatus, setVehicleStatus] = useState('OK');
  const [error, setError] = useState('');

  useEffect(() => {
    api(`races/${reg.raceId}`).then((d) => {
      const pts = (d.routes?.[0]?.points || []);
      setPoints(pts);
      if (pts.length) setRoutePointId(pts[0].id);
    }).catch(() => {});
  }, [reg.raceId]);

  const submit = async () => {
    try {
      await api('withdrawals', {
        method: 'POST',
        body: { registrationId: reg.id, routePointId: routePointId || undefined, kmMark: kmMark ? Number(kmMark) : undefined, reason, needsShuttle, vehicleStatus },
      });
      onClose(true);
    } catch (e: any) { setError(e.message); }
  };

  return (
    <div className="card">
      <h2>退赛登记 — {reg.race?.name}</h2>
      <ErrorBox error={error} />
      <div className="form-row">
        <div className="field"><label>退赛位置（点位）</label>
          <select value={routePointId} onChange={(e) => setRoutePointId(e.target.value)}>
            {points.map((p: any) => <option key={p.id} value={p.id}>{p.name}（{p.kmMark}km）</option>)}
          </select>
        </div>
        <div className="field"><label>或公里数</label><input type="number" value={kmMark} onChange={(e) => setKmMark(e.target.value)} placeholder="如 32.5" /></div>
      </div>
      <div className="field"><label>退赛原因</label><input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="如：机械故障 / 身体不适" /></div>
      <div className="form-row">
        <div className="field"><label>车辆状态</label>
          <select value={vehicleStatus} onChange={(e) => setVehicleStatus(e.target.value)}>
            <option value="OK">完好</option><option value="DAMAGED">损坏</option><option value="LEFT_ON_SITE">遗留现场</option>
          </select>
        </div>
        <div className="checks" style={{ gridTemplateColumns: '1fr', marginTop: 18 }}>
          <label className={needsShuttle ? 'on' : ''}>
            <input type="checkbox" checked={needsShuttle} onChange={(e) => setNeedsShuttle(e.target.checked)} /> 需要接驳车
          </label>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button className="btn primary" onClick={submit} disabled={!reason}>提交退赛</button>
        <button className="btn" onClick={() => onClose(false)}>取消</button>
      </div>
    </div>
  );
}

function NoticesTab() {
  const [notices, setNotices] = useState<any[]>([]);
  useEffect(() => { api('events/notifications/rider').then(setNotices).catch(() => {}); }, []);
  return (
    <div className="card">
      <h2>选手通知（裁判指令 / 赛事公告）</h2>
      {notices.length === 0 ? <div className="muted">暂无通知</div> : (
        <table>
          <thead><tr><th>时间</th><th>标题</th><th>内容</th></tr></thead>
          <tbody>
            {notices.map((n) => (
              <tr key={n.id}><td className="small">{fmtTime(n.createdAt)}</td><td>{n.title}</td><td>{n.message}</td></tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
