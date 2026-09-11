'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, setSession } from '@/lib/api';
import { roleHome } from '@/components/Nav';

const QUICK = [
  ['admin', 'Admin@123', '赛事运营'],
  ['referee', 'Referee@123', '裁判'],
  ['medic', 'Medic@123', '医疗'],
  ['checkin', 'Checkin@123', '检录员'],
  ['supply', 'Supply@123', '补给员'],
  ['volunteer', 'Volunteer@123', '志愿者'],
  ['rider1', 'Rider@123', '选手·张伟'],
  ['rider8', 'Rider@123', '选手·周杰(未报名)'],
];

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const login = async (u?: string, p?: string) => {
    setError('');
    setLoading(true);
    try {
      const data = await api('auth/login', { method: 'POST', body: { username: u || username, password: p || password } });
      setSession(data.token, data.user);
      router.push(roleHome(data.user.role));
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-wrap">
      <div className="logo">
        城市骑行<span>赛事平台</span>
      </div>
      <p className="muted" style={{ textAlign: 'center', marginBottom: 18 }}>
        报名分组 · 赛道补给 · 检录发车 · 成绩档案 · 统一时间轴
      </p>
      <div className="card">
        {error && <div className="alert error">{error}</div>}
        <div className="field">
          <label>用户名</label>
          <input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="用户名" />
        </div>
        <div className="field">
          <label>密码</label>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="密码" onKeyDown={(e) => e.key === 'Enter' && login()} />
        </div>
        <button className="btn primary" style={{ width: '100%' }} disabled={loading} onClick={() => login()}>
          {loading ? '登录中…' : '登 录'}
        </button>
        <h3 className="muted small" style={{ marginTop: 16, marginBottom: 6 }}>演示账号（点击直接登录）</h3>
        <div className="quick-accounts">
          {QUICK.map(([u, p, label]) => (
            <button key={u} className="btn" onClick={() => login(u, p)} disabled={loading}>
              {label}
            </button>
          ))}
        </div>
      </div>
      <div className="footer-note">城市骑行赛事报名分组与赛道补给管理平台</div>
    </div>
  );
}
