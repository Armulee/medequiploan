'use client';

import { Fingerprint } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import Alert from '@/components/Alert';
import Logo from '@/components/Logo';
import { useSession } from '@/app/staff/SessionContext';
import { passkeyError } from './PasskeySetup';

export default function LoginView() {
  const { login, loginWithPasskey } = useSession();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState<'password' | 'passkey' | null>(null);
  // Hidden by default: staff sign in with a passkey, and a password box in
  // plain sight invites people to keep using one. It is still one tap away
  // for a first sign-in or after an admin reset.
  const [showPassword, setShowPassword] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setBusy('password');
    try {
      await login(username, password);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'เข้าสู่ระบบไม่สำเร็จ');
      setBusy(null);
    }
  }

  async function onPasskey() {
    setError('');
    setBusy('passkey');
    try {
      await loginWithPasskey();
    } catch (err) {
      setError(passkeyError(err));
      setBusy(null);
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

        {/* No username field: the passkey is discoverable, so the browser
            knows which account it belongs to and the person types nothing. */}
        <button
          type="button"
          className="btn btn-primary btn-block"
          style={{ marginTop: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
          onClick={() => void onPasskey()}
          disabled={busy !== null}
        >
          <Fingerprint size={18} />
          {busy === 'passkey' ? 'กำลังยืนยันตัวตน...' : 'เข้าสู่ระบบด้วยพาสคีย์'}
        </button>

        {!showPassword ? (
          <p className="footer-note" style={{ paddingBottom: 0 }}>
            เพิ่งได้รับรหัสผ่านจากแอดมิน?{' '}
            <button type="button" className="link-button" onClick={() => setShowPassword(true)}>
              เข้าสู่ระบบด้วยรหัสผ่าน
            </button>
          </p>
        ) : (
          <form onSubmit={onSubmit} style={{ textAlign: 'left', marginTop: 18 }}>
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
              <div className="hint">
                ใช้ได้เฉพาะบัญชีที่ยังไม่ได้สร้างพาสคีย์ · เข้าแล้วระบบจะให้สร้างพาสคีย์ทันที
              </div>
            </div>
            <button type="submit" className="btn btn-outline btn-block" disabled={busy !== null}>
              {busy === 'password' ? 'กำลังเข้าสู่ระบบ...' : 'เข้าสู่ระบบด้วยรหัสผ่าน'}
            </button>
          </form>
        )}

        <p className="footer-note">
          ผู้ใช้ทั่วไป <Link href="/request">ส่งคำขอยืมอุปกรณ์ที่นี่</Link> (ไม่ต้อง login) ·{' '}
          <Link href="/">กลับหน้าแรก</Link>
        </p>
      </div>
    </div>
  );
}
