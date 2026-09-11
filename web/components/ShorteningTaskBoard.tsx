'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Badge } from './ui';
import { POINT_TYPES, SHORT_TASK_KINDS, SHORT_TASK_STATUS, fmtTime } from '@/lib/labels';

/**
 * 赛段缩短岗位看板：
 * - 重生成任务（补给物资 / 接驳车辆 / 志愿者站位），按角色过滤
 * - 岗位通知与签收状态；未接到通知的岗位红色标记
 */
export default function ShorteningTaskBoard({
  raceId,
  roleFilter,
  canAck,
  postsOnly,
  pointTypes,
  onChange,
}: {
  raceId: string;
  roleFilter?: string; // 仅显示该角色的任务
  canAck: boolean; // 是否显示"签收新关门时间"按钮
  postsOnly?: boolean; // 只显示岗位签收表（医疗等无任务角色）
  pointTypes?: string[]; // 岗位表只显示这些点位类型
  onChange?: () => void;
}) {
  const [board, setBoard] = useState<any>(null);

  const load = () =>
    api(`shortenings/race/${raceId}/board`)
      .then(setBoard)
      .catch(() => {});
  useEffect(() => {
    if (raceId) load();
  }, [raceId]);

  if (!board?.current) return null;
  const cur = board.current;

  const ack = async (pointId: string) => {
    try {
      await api(`shortenings/${cur.id}/ack-post`, { method: 'POST', body: { routePointId: pointId } });
      await load();
      onChange?.();
    } catch {}
  };
  const complete = async (taskId: string) => {
    const note = prompt('完成备注（可选）') || '';
    try {
      await api(`shortening-tasks/${taskId}/complete`, { method: 'POST', body: { note } });
      await load();
      onChange?.();
    } catch {}
  };

  const tasks = (board.tasks || []).filter((t: any) => !roleFilter || t.targetRole === roleFilter);
  const unnotified = (board.posts || []).filter((p: any) => p.unnotified);
  const postsAll: any[] = board.posts || [];
  const shownPosts = pointTypes ? postsAll.filter((p) => pointTypes.includes(p.type)) : postsAll;

  return (
    <div>
      {unnotified.length > 0 && (
        <div className="alert error" style={{ marginBottom: 10 }}>
          <strong>⚠ 未接到通知的岗位（{unnotified.length}）：</strong>
          {unnotified.map((p: any) => `「${p.name}」`).join('、')}
          <div className="small">这些点位无在岗人员、未签收新关门时间，已自动生成紧急封路/联络任务。</div>
        </div>
      )}

      {!postsOnly && (
        <>
          <h3 style={{ marginTop: 12 }}>重新生成的任务{roleFilter ? `（${roleFilter === 'SUPPLY' ? '补给' : '志愿者'}）` : ''}</h3>
          {tasks.length === 0 ? (
            <div className="muted small">暂无任务</div>
          ) : (
            <table>
              <thead>
                <tr><th>类型</th><th>任务</th><th>详情</th><th>状态</th><th>操作</th></tr>
              </thead>
              <tbody>
                {tasks.map((t: any) => (
                  <tr key={t.id} style={t.unnotified ? { background: '#fff3f3' } : undefined}>
                    <td><Badge color={SHORT_TASK_KINDS[t.kind]?.[1]}>{SHORT_TASK_KINDS[t.kind]?.[0] || t.kind}</Badge></td>
                    <td className="small">{t.title}{t.completedAt && <div className="muted">{fmtTime(t.completedAt)} 完成</div>}</td>
                    <td className="small muted">{t.detail}</td>
                    <td><Badge color={SHORT_TASK_STATUS[t.status]?.[1]}>{SHORT_TASK_STATUS[t.status]?.[0] || t.status}</Badge></td>
                    <td>{t.status !== 'DONE' && <button className="btn sm success" onClick={() => complete(t.id)}>完成</button>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </>
      )}

      <h3 style={{ marginTop: 16 }}>岗位通知与签收{canAck ? '' : '（仅查看）'}</h3>
      <table>
        <thead>
          <tr><th>点位</th><th>类型</th><th>公里</th><th>关门</th><th>状态</th><th>通知/签收</th></tr>
        </thead>
        <tbody>
          {shownPosts.map((p: any) => (
            <tr key={p.pointId} style={!p.active ? { opacity: 0.55 } : undefined}>
              <td className="small">{p.name}{!p.active && <Badge color="gray">路段撤销</Badge>}</td>
              <td className="small">{POINT_TYPES[p.type] || p.type}</td>
              <td>{p.kmMark}km</td>
              <td><strong>{p.cutoffTime || '—'}</strong></td>
              <td>
                {!p.staffed ? (
                  <Badge color="red">无人值守</Badge>
                ) : p.acknowledged ? (
                  <Badge color="green">已签收</Badge>
                ) : p.notified ? (
                  <Badge color="orange">待签收</Badge>
                ) : (
                  <Badge color="gray">—</Badge>
                )}
              </td>
              <td>
                {canAck && p.notified && !p.acknowledged && (
                  <button className="btn sm primary" onClick={() => ack(p.pointId)}>签收新关门时间</button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
