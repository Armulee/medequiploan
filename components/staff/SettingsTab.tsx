'use client';

import { KeyRound, UserCog } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { apiJson } from '@/app/lib/api';
import { useSession } from '@/app/staff/SessionContext';
import { MIN_PASSWORD } from '@/lib/password';
import type { SessionUser } from '@/app/lib/types';

/**
 * Your own account, and nothing else. Role and active status are an admin's
 * business and live on the staff tab; the server enforces that separately by
 * taking the id from the session rather than the request.
 */
export default function SettingsTab({ user }: { user: SessionUser }) {
  const { setUser } = useSession();

  const [name, setName] = useState(user.name);
  const [username, setUsername] = useState(user.username);
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [again, setAgain] = useState('');
  const [busy, setBusy] = useState<'profile' | 'password' | null>(null);

  const usernameChanged = username.trim().toLowerCase() !== user.username;

  async function save(body: Record<string, unknown>, kind: 'profile' | 'password', done: string) {
    setBusy(kind);
    try {
      const d = await apiJson<{ user: SessionUser }>('/api/auth/me', 'PATCH', body);
      setUser(d.user);
      setName(d.user.name);
      setUsername(d.user.username);
      setCurrent('');
      setNext('');
      setAgain('');
      toast.success(done);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'บันทึกไม่สำเร็จ');
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      <div className="card">
        <h1>ตั้งค่าบัญชีของฉัน</h1>
        <p style={{ color: 'var(--text-muted)', marginTop: -6 }}>
          แก้ได้เฉพาะบัญชีของตัวเอง · สิทธิ์และการเปิด-ปิดบัญชีต้องให้แอดมินเป็นคนจัดการ
        </p>
      </div>

      <form
        className="card"
        onSubmit={(e) => {
          e.preventDefault();
          void save(
            usernameChanged
              ? { name: name.trim(), username: username.trim(), current_password: current }
              : { name: name.trim() },
            'profile',
            'บันทึกข้อมูลบัญชีแล้ว'
          );
        }}
      >
        <h2 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <UserCog size={20} color="var(--orange-dark)" />
          ข้อมูลบัญชี
        </h2>

        <div className="field">
          <label htmlFor="acc_name">ชื่อที่แสดง</label>
          <input id="acc_name" value={name} onChange={(e) => setName(e.target.value)} required />
          <div className="hint">ชื่อนี้จะขึ้นในประวัติการทำรายการทุกครั้งที่คุณยืม คืน หรืออนุมัติ</div>
        </div>

        <div className="field">
          <label htmlFor="acc_username">ชื่อผู้ใช้ (สำหรับเข้าสู่ระบบ)</label>
          <input
            id="acc_username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoCapitalize="none"
            autoCorrect="off"
            required
          />
          <div className="hint">ตัวพิมพ์เล็ก a-z ตัวเลข และ . _ - เท่านั้น</div>
        </div>

        {/* Only asked for when the answer matters — changing a display name is
            not a credential change. */}
        {usernameChanged && (
          <div className="field">
            <label htmlFor="acc_current_u">ยืนยันรหัสผ่านปัจจุบัน</label>
            <input
              id="acc_current_u"
              type="password"
              value={current}
              onChange={(e) => setCurrent(e.target.value)}
              autoComplete="current-password"
              required
            />
            <div className="hint">ต้องยืนยันเพราะชื่อผู้ใช้คือสิ่งที่ใช้เข้าสู่ระบบ</div>
          </div>
        )}

        <button type="submit" className="btn btn-primary" disabled={busy !== null}>
          {busy === 'profile' ? 'กำลังบันทึก...' : 'บันทึกข้อมูลบัญชี'}
        </button>
      </form>

      <form
        className="card"
        onSubmit={(e) => {
          e.preventDefault();
          if (next !== again) {
            toast.error('รหัสผ่านใหม่ทั้งสองช่องไม่ตรงกัน');
            return;
          }
          void save(
            { current_password: current, password: next },
            'password',
            'เปลี่ยนรหัสผ่านแล้ว'
          );
        }}
      >
        <h2 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <KeyRound size={20} color="var(--orange-dark)" />
          เปลี่ยนรหัสผ่าน
        </h2>

        <div className="field">
          <label htmlFor="acc_current">รหัสผ่านปัจจุบัน</label>
          <input
            id="acc_current"
            type="password"
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
            autoComplete="current-password"
            required
          />
        </div>

        {/* Not a .row: "พิมพ์รหัสผ่านใหม่อีกครั้ง" wraps to two lines beside
            "รหัสผ่านใหม่" on a phone, and the boxes stop lining up. */}
        <div className="pw-row">
          <div className="field">
            <label htmlFor="acc_new">รหัสผ่านใหม่</label>
            <input
              id="acc_new"
              type="password"
              value={next}
              onChange={(e) => setNext(e.target.value)}
              autoComplete="new-password"
              minLength={8}
              required
            />
            <div className="hint">อย่างน้อย {MIN_PASSWORD} ตัวอักษร · ห้ามมีชื่อผู้ใช้อยู่ในนั้น</div>
          </div>
          <div className="field">
            <label htmlFor="acc_again">พิมพ์รหัสผ่านใหม่อีกครั้ง</label>
            <input
              id="acc_again"
              type="password"
              value={again}
              onChange={(e) => setAgain(e.target.value)}
              autoComplete="new-password"
              minLength={8}
              required
            />
          </div>
        </div>

        <button type="submit" className="btn btn-primary" disabled={busy !== null}>
          {busy === 'password' ? 'กำลังเปลี่ยน...' : 'เปลี่ยนรหัสผ่าน'}
        </button>
      </form>
    </>
  );
}
