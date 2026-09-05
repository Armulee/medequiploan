'use client';

import { Fingerprint, ShieldCheck } from 'lucide-react';
import { useState } from 'react';
import Alert from '@/components/Alert';
import Logo from '@/components/Logo';
import { api, apiJson } from '@/app/lib/api';
import { useSession } from '@/app/staff/SessionContext';

/**
 * The gate an account passes through exactly once: sign in with the password
 * an admin handed over, then enrol a passkey before anything else loads.
 *
 * This is what makes "staff must use a passkey" true rather than encouraged.
 * The account is already signed in at this point — the cookie is real — but
 * StaffFrame refuses to render the app while the passkey count is zero, and
 * the server refuses a password sign-in the moment the count is one. So the
 * only way out of this screen is forward.
 *
 * Same banner reasoning as LoginView: a WebAuthn failure ("this device has no
 * screen lock", "you cancelled") has to stay on screen while the person fixes
 * it, and there is no AppShell here for a toast to sit in anyway.
 */
export default function PasskeySetup() {
  const { user, logout, refresh } = useSession();
  const [label, setLabel] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function enrol() {
    setError('');
    setBusy(true);
    try {
      // Loaded on demand: the public pages and every already-enrolled staff
      // member never need this bundle.
      const { startRegistration } = await import('@simplewebauthn/browser');
      const start = await api<{
        options: Parameters<typeof startRegistration>[0]['optionsJSON'];
        challenge_id: string;
      }>('/api/auth/passkey/register');
      const response = await startRegistration({ optionsJSON: start.options });
      await apiJson('/api/auth/passkey/register', 'POST', {
        challenge_id: start.challenge_id,
        response,
        label: label.trim(),
      });
      // Flips the count to one, which is what lets StaffFrame render the app.
      await refresh();
    } catch (e) {
      setError(passkeyError(e));
      setBusy(false);
    }
  }

  return (
    <div className="login-wrap">
      <div className="login-card card">
        <div className="logo">
          <Logo size={28} />
        </div>
        <h1>ตั้งค่าพาสคีย์</h1>
        <p style={{ color: 'var(--text-muted)', marginTop: -8 }}>
          สวัสดี {user?.name} · อีกขั้นตอนเดียวก่อนเริ่มใช้งาน
        </p>

        <Alert kind="error">{error}</Alert>

        <div className="passkey-why">
          <p>
            <ShieldCheck size={18} color="var(--orange-dark)" />
            <span>
              พาสคีย์คือการยืนยันตัวตนด้วย<strong>ลายนิ้วมือ ใบหน้า หรือ PIN ของเครื่องคุณ</strong>{' '}
              ไม่ต้องจำรหัสผ่านอีก
            </span>
          </p>
          <p>
            <Fingerprint size={18} color="var(--orange-dark)" />
            <span>
              เว็บปลอมที่ทำหน้าตาเหมือนหน้านี้จะ<strong>ใช้พาสคีย์ของคุณไม่ได้</strong>{' '}
              เพราะพาสคีย์ผูกกับชื่อเว็บจริงเท่านั้น
            </span>
          </p>
        </div>

        <form
          style={{ textAlign: 'left', marginTop: 10 }}
          onSubmit={(e) => {
            e.preventDefault();
            void enrol();
          }}
        >
          <div className="field">
            <label htmlFor="pk_label">ชื่อเรียกอุปกรณ์นี้ (ไม่บังคับ)</label>
            <input
              id="pk_label"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="เช่น มือถือของฉัน, คอมที่ทำงาน"
              maxLength={64}
            />
            <div className="hint">ไว้ดูภายหลังว่าพาสคีย์อันไหนคืออุปกรณ์ไหน</div>
          </div>

          <button type="submit" className="btn btn-primary btn-block" disabled={busy}>
            {busy ? 'กำลังสร้างพาสคีย์...' : 'สร้างพาสคีย์บนอุปกรณ์นี้'}
          </button>
        </form>

        <p className="footer-note" style={{ paddingBottom: 0 }}>
          ใช้อุปกรณ์เครื่องนี้ไม่ได้?{' '}
          <button type="button" className="link-button" onClick={() => void logout()}>
            ออกจากระบบ
          </button>
          <br />
          ทำพาสคีย์หายภายหลัง ให้แอดมินรีเซ็ตให้ได้จากหน้าเจ้าหน้าที่
        </p>
      </div>
    </div>
  );
}

/**
 * Browser WebAuthn errors arrive as DOMException names, in English, and mean
 * nothing to the person reading them. Turn the ones that actually happen into
 * something that says what to do next.
 */
export function passkeyError(e: unknown): string {
  const name = e instanceof DOMException ? e.name : '';
  if (name === 'NotAllowedError') {
    return 'ยกเลิกหรือหมดเวลาไปก่อน · ลองกดปุ่มอีกครั้งแล้วยืนยันด้วยลายนิ้วมือ ใบหน้า หรือ PIN';
  }
  if (name === 'InvalidStateError') {
    return 'อุปกรณ์นี้สร้างพาสคีย์ไว้แล้ว · ลองเข้าสู่ระบบด้วยพาสคีย์ หรือใช้อุปกรณ์อื่น';
  }
  if (name === 'SecurityError') {
    return 'เบราว์เซอร์ไม่ยอมให้สร้างพาสคีย์บนที่อยู่เว็บนี้ (ต้องเป็น https)';
  }
  if (name === 'NotSupportedError' || name === 'AbortError') {
    return 'อุปกรณ์หรือเบราว์เซอร์นี้ยังไม่รองรับพาสคีย์ · ลองเครื่องอื่นหรือเบราว์เซอร์อื่น';
  }
  if (e instanceof Error && e.message) return e.message;
  return 'สร้างพาสคีย์ไม่สำเร็จ';
}
