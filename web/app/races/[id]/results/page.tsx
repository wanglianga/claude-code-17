'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Nav from '@/components/Nav';
import ResultsView from '@/components/ResultsView';
import { Badge, useRequireRole } from '@/components/ui';
import { api } from '@/lib/api';
import { RACE_STATUS } from '@/lib/labels';

export default function RaceResultsPage() {
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
            成绩榜 — {race.name} <Badge color={RACE_STATUS[race.status]?.[1]}>{RACE_STATUS[race.status]?.[0]}</Badge>
          </h2>
          <ResultsView raceId={race.id} />
        </div>
      </div>
    </div>
  );
}
