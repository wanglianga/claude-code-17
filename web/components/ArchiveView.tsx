'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { APPEAL_STATUS, EVENT_TYPES, RESULT_RULES, RESULT_STATUS, SHORT_TASK_KINDS, SHORTENING_STATUS, WEATHER_KINDS, fmtSeconds, fmtTime } from '@/lib/labels';
import { Badge } from './ui';

export default function ArchiveView({ raceId }: { raceId: string }) {
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api(`archive/race/${raceId}`)
      .then(setData)
      .catch((e) => setError(e.message));
  }, [raceId]);

  if (error) return <div className="alert error">{error}</div>;
  if (!data) return <div className="muted">加载中…</div>;

  const { stats } = data;
  return (
    <div>
      <div className="grid4" style={{ marginBottom: 18 }}>
        <div className="stat"><div className="num">{stats.approved}</div><div className="lbl">审核通过</div></div>
        <div className="stat"><div className="num">{stats.finished}</div><div className="lbl">完赛</div></div>
        <div className="stat"><div className="num">{stats.withdrawals}</div><div className="lbl">退赛</div></div>
        <div className="stat"><div className="num">{stats.medicalCases}</div><div className="lbl">医疗处置</div></div>
      </div>

      <div className="card">
        <h2>成绩与芯片记录（颁奖依据）</h2>
        {data.results.length === 0 ? <div className="muted">无成绩记录</div> : (
          <table>
            <thead>
              <tr><th>号码</th><th>选手</th><th>组别</th><th>状态</th><th>成绩规则</th><th>净成绩</th><th>芯片记录</th></tr>
            </thead>
            <tbody>
              {data.results.map((r: any, i: number) => (
                <tr key={i}>
                  <td>{r.bibNumber}</td>
                  <td>{r.riderName}</td>
                  <td>{r.group}</td>
                  <td><Badge color={RESULT_STATUS[r.status]?.[1] || 'gray'}>{RESULT_STATUS[r.status]?.[0] || r.status}</Badge></td>
                  <td>{r.resultRule && r.resultRule !== 'NORMAL' ? <Badge color={RESULT_RULES[r.resultRule]?.[1] || 'gray'}>{RESULT_RULES[r.resultRule]?.[0] || r.resultRule}</Badge> : '—'}</td>
                  <td>{fmtSeconds(r.netSeconds)}</td>
                  <td className="small muted">
                    {r.chips.map((c: any, j: number) => (
                      <div key={j}>{c.point} · {fmtTime(c.readAt)}</div>
                    ))}
                    {r.chips.length === 0 && '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="grid2">
        <div className="card">
          <h2>补给汇总与异常（保险/下届路线优化参考）</h2>
          {data.supply.length === 0 ? <div className="muted">无补给点</div> : (
            <table>
              <thead>
                <tr><th>点位</th><th>通过</th><th>饮水</th><th>能量胶</th><th>配件</th><th>余量</th><th>异常</th></tr>
              </thead>
              <tbody>
                {data.supply.map((s: any, i: number) => (
                  <tr key={i}>
                    <td>{s.point} <span className="muted small">{s.kmMark}km</span></td>
                    <td>{s.ridersPassed}</td>
                    <td>{s.waterGiven}</td>
                    <td>{s.gelsGiven}</td>
                    <td>{s.partsGiven}</td>
                    <td className="small">{s.waterStockLeft}/{s.gelStockLeft}/{s.partsStockLeft}</td>
                    <td>{s.anomaly ? <Badge color="red">库存归零</Badge> : <Badge color="green">正常</Badge>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="card">
          <h2>医疗处置</h2>
          {data.medical.length === 0 ? <div className="muted">无医疗记录</div> : (
            <table>
              <thead><tr><th>时间</th><th>号码</th><th>伤情</th><th>处置</th><th>转归</th></tr></thead>
              <tbody>
                {data.medical.map((m: any) => (
                  <tr key={m.id}>
                    <td className="small">{fmtTime(m.createdAt)}</td>
                    <td>{m.bibNumber || '—'}</td>
                    <td>{m.condition}</td>
                    <td>{m.treatment}</td>
                    <td>{m.outcome || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <div className="grid2">
        <div className="card">
          <h2>退赛记录</h2>
          {data.withdrawals.length === 0 ? <div className="muted">无退赛</div> : (
            <table>
              <thead><tr><th>时间</th><th>位置</th><th>原因</th><th>接驳</th><th>车辆</th></tr></thead>
              <tbody>
                {data.withdrawals.map((w: any) => (
                  <tr key={w.id}>
                    <td className="small">{fmtTime(w.reportedAt)}</td>
                    <td>{w.kmMark != null ? `${w.kmMark}km` : '—'}</td>
                    <td>{w.reason}</td>
                    <td>{w.needsShuttle ? <Badge color="orange">需要</Badge> : '否'}</td>
                    <td>{w.vehicleStatus}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="card">
          <h2>申诉与证据</h2>
          {data.appeals.length === 0 ? <div className="muted">无申诉</div> : (
            <table>
              <thead><tr><th>号码</th><th>类别</th><th>理由</th><th>证据</th><th>结果</th></tr></thead>
              <tbody>
                {data.appeals.map((a: any) => (
                  <tr key={a.id}>
                    <td>{a.bibNumber}</td>
                    <td>{a.category}</td>
                    <td className="small">{a.reason}</td>
                    <td className="small">{a.evidence || '—'}</td>
                    <td>
                      <Badge color={APPEAL_STATUS[a.status]?.[1] || 'gray'}>{APPEAL_STATUS[a.status]?.[0] || a.status}</Badge>
                      {a.resolution && <div className="small muted">{a.resolution}</div>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <div className="card">
        <h2>天气突变 · 赛段缩短决策链</h2>
        {(!data.shortenings || data.shortenings.length === 0) ? <div className="muted">无赛段缩短记录</div> : (
          <div>
            {data.shortenings.map((s: any) => (
              <div key={s.id} style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 12, marginBottom: 12 }}>
                <h3 style={{ margin: 0 }}>
                  {s.alert ? `${WEATHER_KINDS[s.alert.kind] || s.alert.kind}预警：${s.alert.title}` : '赛段缩短'}
                  <Badge color={SHORTENING_STATUS[s.status]?.[1]}>{SHORTENING_STATUS[s.status]?.[0] || s.status}</Badge>
                </h3>
                <div className="small muted">
                  预警时段 {s.alert?.issuedAt}-{s.alert?.effectiveUntil} · 新终点 {s.junction?.name}（{s.junction?.kmMark}km）
                  {s.proposedAt && <> · 提交 {fmtTime(s.proposedAt)}</>}{s.confirmedAt && <> · 裁判确认 {fmtTime(s.confirmedAt)}</>}
                  {' '}· 岗位通知 {s.notifiedPostCount}，签收 {s.acknowledgedPostCount}，未接到通知 {s.unnotifiedTasks}
                </div>
                <table>
                  <thead><tr><th>组别</th><th>新关门时间</th><th>已过关键路口</th><th>未通过</th></tr></thead>
                  <tbody>
                    {s.cutoffPlan.map((p: any) => (
                      <tr key={p.groupId}><td>{p.groupName}</td><td><strong>{p.cutoffTime}</strong></td><td>{p.ridersAhead}</td><td>{p.ridersBehind}</td></tr>
                    ))}
                  </tbody>
                </table>
                <p className="small muted">评估依据：{s.assessmentSummary}</p>
                <table>
                  <thead><tr><th>任务类型</th><th>任务</th><th>状态</th></tr></thead>
                  <tbody>
                    {s.tasks.map((t: any, i: number) => (
                      <tr key={i} style={t.unnotified ? { background: '#fff3f3' } : undefined}>
                        <td><Badge color={SHORT_TASK_KINDS[t.kind]?.[1]}>{SHORT_TASK_KINDS[t.kind]?.[0] || t.kind}</Badge></td>
                        <td className="small">{t.title}<div className="muted">{t.detail}</div></td>
                        <td>{t.unnotified ? <Badge color="red">未接到通知</Badge> : t.status === 'DONE' ? <Badge color="green">已完成</Badge> : <Badge color="orange">待处理</Badge>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="card">
        <h2>赛道事件</h2>
        {data.events.length === 0 ? <div className="muted">无事件</div> : (
          <table>
            <thead><tr><th>时间</th><th>类型</th><th>标题</th><th>状态</th></tr></thead>
            <tbody>
              {data.events.map((e: any) => (
                <tr key={e.id}>
                  <td className="small">{fmtTime(e.createdAt)}</td>
                  <td>{EVENT_TYPES[e.type] || e.type}</td>
                  <td>{e.title}</td>
                  <td>{e.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
