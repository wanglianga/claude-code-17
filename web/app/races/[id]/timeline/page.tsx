'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Nav from '@/components/Nav';
import TimelineView from '@/components/TimelineView';
import { Badge, useRequireRole } from '@/components/ui';
import { api } from '@/lib/api';
import { RACE_STATUS } from '@/lib/labels';

export default function RaceTimelinePage() {
  const { ready } = useRequireRole('RIDER', 'OPS', 'CHECKIN', 'SUPPLY', 'REFEREE', 'MEDICAL', 'VOLUNTEER');
  const params = useParams();
  const [race, setRace] = useState<any>(null);
  useEffect(() => {
    if (ready) api(`races/${params.id}`).then(setRace).catch(() => {});
  }, [ready, params.id]);
  if (!ready || !race) return null;
  return (
    <div>
      <Nav />
      <div className="container">
        <div className="card">
          <h2>
            统一时间轴 — {race.name} <Badge color={RACE_STATUS[race.status]?.[1]}>{RACE_STATUS[race.status]?.[0]}</Badge>
          </h2>
          <p className="muted small">裁判指令、医疗处置、选手通知、事件与成绩都在同一时间轴上；按组别过滤可还原每个决定影响了哪些组别。</p>
          <TimelineView raceId={race.id} groups={race.groups} />
        </div>
      </div>
    </div>
  );
}
