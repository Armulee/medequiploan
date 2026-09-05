'use client';

import Link from 'next/link';
import { useState } from 'react';
import Alert from '@/components/Alert';
import Logo from '@/components/Logo';
import { useSession } from '@/app/staff/SessionContext';

export default function LoginView() {
  const { login } = useSession();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await login(username, password);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'เข้าสู่ระบบไม่สำเร็จ');
      setBusy(false);
    }
  }

  return (
    <div className="login-wrap">
      <div className="login-card card">
        <div className="logo">
          <Logo size={28} />
        </div>
        <h1>ศูนย์ยืม-คืนกายอุปกรณ์</h1>
        <p style={{ color: 'var(--text-muted)', marginTop: -8 }}>เข้าสู่ระบบสำหรับเจ้าหน้าที่</p>

        {/* The one banner left in the staff app, on purpose: a wrong password
            or a rate-limit message has to stay on screen while the person
            retypes, and a toast would time out while they were still reading. */}
        <Alert kind="error">{error}</Alert>

        <form onSubmit={onSubmit} style={{ textAlign: 'left', marginTop: 10 }}>
          <div className="field">
            <label htmlFor="username">ชื่อผู้ใช้</label>
            <input
              id="username"
              type="text"
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
            />
          </div>
          <div className="field">
            <label htmlFor="password">รหัสผ่าน</label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <button type="submit" className="btn btn-primary btn-block" disabled={busy}>
            {busy ? 'กำลังเข้าสู่ระบบ...' : 'เข้าสู่ระบบ'}
          </button>
        </form>

        <p className="footer-note">
          ผู้ใช้ทั่วไป <Link href="/request">ส่งคำขอยืมอุปกรณ์ที่นี่</Link> (ไม่ต้อง login) ·{' '}
          <Link href="/">กลับหน้าแรก</Link>
        </p>
      </div>
    </div>
  );
}
