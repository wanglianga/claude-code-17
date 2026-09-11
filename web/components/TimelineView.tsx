'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { TIMELINE_TYPES, fmtTime } from '@/lib/labels';
import { Badge } from './ui';

export default function TimelineView({ raceId, groups }: { raceId: string; groups: any[] }) {
  const [entries, setEntries] = useState<any[]>([]);
  const [groupId, setGroupId] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api(`timeline/race/${raceId}${groupId ? `?groupId=${groupId}` : ''}`)
      .then(setEntries)
      .finally(() => setLoading(false));
  }, [raceId, groupId]);

  return (
    <div>
      <div className="field" style={{ maxWidth: 320 }}>
        <label>按组别过滤（还原每个决定影响了哪些组别）</label>
        <select value={groupId} onChange={(e) => setGroupId(e.target.value)}>
          <option value="">全部 / 未指定组别</option>
          {(groups || []).map((g) => (
            <option key={g.id} value={g.id}>
              {g.name}
            </option>
          ))}
        </select>
      </div>
      {loading ? (
        <div className="muted">加载中…</div>
      ) : entries.length === 0 ? (
        <div className="muted">暂无时间轴记录</div>
      ) : (
        <div className="timeline">
          {entries.map((e) => {
            const [label, color] = TIMELINE_TYPES[e.type] || [e.type, 'gray'];
            return (
              <div className="timeline-item" key={e.id}>
                <div className="time">
                  {fmtTime(e.createdAt)} · <Badge color={color}>{label}</Badge>{' '}
                  {e.actorName && <span className="muted">操作人：{e.actorName}</span>}
                </div>
                <div>{e.message}</div>
                {e.affectedGroups?.length > 0 && (
                  <div className="small muted">
                    影响组别：{e.affectedGroups.map((g: any) => g.name).join('、')}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
