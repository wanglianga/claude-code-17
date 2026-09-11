'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Nav from '@/components/Nav';
import ArchiveView from '@/components/ArchiveView';
import { Badge, useRequireRole } from '@/components/ui';
import { api } from '@/lib/api';
import { RACE_STATUS } from '@/lib/labels';

export default function RaceArchivePage() {
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
            赛事档案 — {race.name} <Badge color={RACE_STATUS[race.status]?.[1]}>{RACE_STATUS[race.status]?.[0]}</Badge>
          </h2>
          <p className="muted small">成绩、芯片记录、补给异常、医疗处置与申诉证据汇聚于同一档案，用于颁奖、保险与下一届路线优化。</p>
        </div>
        <ArchiveView raceId={race.id} />
      </div>
    </div>
  );
}
