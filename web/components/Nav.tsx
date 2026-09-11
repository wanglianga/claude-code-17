'use client';

import { useRouter } from 'next/navigation';
import { clearSession, getUser } from '@/lib/api';
import { ROLE_LABELS } from '@/lib/labels';

const ROLE_HOME: Record<string, string> = {
  RIDER: '/rider',
  OPS: '/ops',
  CHECKIN: '/checkin',
  SUPPLY: '/supply',
  REFEREE: '/referee',
  MEDICAL: '/medical',
  VOLUNTEER: '/volunteer',
};

export function roleHome(role: string) {
  return ROLE_HOME[role] || '/login';
}

export default function Nav() {
  const router = useRouter();
  const user = getUser();
  if (!user) return null;
  const logout = () => {
    clearSession();
    router.push('/login');
  };
  return (
    <div className="topbar">
      <div className="brand">
        城市骑行<span>赛事平台</span>
      </div>
      <nav>
        <a href={roleHome(user.role)}>工作台</a>
      </nav>
      <div className="user">
        <span className="badge blue">{ROLE_LABELS[user.role] || user.role}</span>
        <span>{user.displayName}</span>
        <button className="btn sm" onClick={logout}>
          退出
        </button>
      </div>
    </div>
  );
}
