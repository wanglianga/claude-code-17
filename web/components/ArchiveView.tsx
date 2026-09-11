'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { APPEAL_STATUS, EVENT_TYPES, RESULT_STATUS, fmtSeconds, fmtTime } from '@/lib/labels';
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
              <tr><th>号码</th><th>选手</th><th>组别</th><th>状态</th><th>净成绩</th><th>芯片记录</th></tr>
            </thead>
            <tbody>
              {data.results.map((r: any, i: number) => (
                <tr key={i}>
                  <td>{r.bibNumber}</td>
                  <td>{r.riderName}</td>
                  <td>{r.group}</td>
                  <td><Badge color={RESULT_STATUS[r.status]?.[1] || 'gray'}>{RESULT_STATUS[r.status]?.[0] || r.status}</Badge></td>
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
