'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getUser } from '@/lib/api';
import { roleHome } from './Nav';

export function Badge({ color, children }: { color: string; children: React.ReactNode }) {
  return <span className={`badge ${color}`}>{children}</span>;
}

export function useRequireRole(...roles: string[]) {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const u = getUser();
    if (!u) {
      router.push('/login');
      return;
    }
    if (roles.length && !roles.includes(u.role)) {
      router.push(roleHome(u.role));
      return;
    }
    setUser(u);
    setReady(true);
  }, []);
  return { user, ready };
}

export function ErrorBox({ error }: { error: string }) {
  if (!error) return null;
  return <div className="alert error">{error}</div>;
}

export function OkBox({ message }: { message: string }) {
  if (!message) return null;
  return <div className="alert ok">{message}</div>;
}

export function Spinner() {
  return <div className="muted" style={{ padding: 20 }}>加载中…</div>;
}
