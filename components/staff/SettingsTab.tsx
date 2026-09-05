'use client';

import { Fingerprint, KeyRound, Trash2, UserCog } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import Dialog, { DialogActions } from '@/components/Dialog';
import { api, apiJson } from '@/app/lib/api';
import { thDateTime } from '@/app/lib/format';
import { useSession } from '@/app/staff/SessionContext';
import { MIN_PASSWORD } from '@/lib/password';
import { passkeyError } from './PasskeySetup';
import type { PasskeyInfo, SessionUser } from '@/app/lib/types';

/**
 * Your own account, and nothing else. Role and active status are an admin's
 * business and live on the staff tab; the server enforces that separately by
 * taking the id from the session rather than the request.
 */
export default function SettingsTab({ user }: { user: SessionUser }) {
  const { setUser, refresh } = useSession();

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

      <PasskeyCard onChanged={refresh} />

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
              minLength={MIN_PASSWORD}
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
              minLength={MIN_PASSWORD}
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

/**
 * The devices that can sign in as you.
 *
 * Adding a second one is the thing that keeps a lost phone from becoming a
 * support call, so it is a plain button rather than something buried. The
 * last one cannot be removed here — the server refuses it, because an account
 * with no passkey and no known password is locked out until an admin resets
 * it.
 */
function PasskeyCard({ onChanged }: { onChanged: () => Promise<void> }) {
  const [list, setList] = useState<PasskeyInfo[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [removing, setRemoving] = useState<PasskeyInfo | null>(null);

  const load = useCallback(async () => {
    try {
      const d = await api<{ passkey_list: PasskeyInfo[] }>('/api/auth/me');
      setList(d.passkey_list ?? []);
    } catch {
      setList([]);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function add() {
    setBusy(true);
    try {
      const { startRegistration } = await import('@simplewebauthn/browser');
      const start = await api<{
        options: Parameters<typeof startRegistration>[0]['optionsJSON'];
        challenge_id: string;
      }>('/api/auth/passkey/register');
      const response = await startRegistration({ optionsJSON: start.options });
      await apiJson('/api/auth/passkey/register', 'POST', {
        challenge_id: start.challenge_id,
        response,
        label: deviceGuess(),
      });
      toast.success('เพิ่มพาสคีย์บนอุปกรณ์นี้แล้ว');
      await load();
      await onChanged();
    } catch (e) {
      toast.error(passkeyError(e));
    } finally {
      setBusy(false);
    }
  }

  async function remove(pk: PasskeyInfo) {
    try {
      await apiJson(`/api/auth/passkey/${pk.passkey_id}`, 'DELETE');
      toast.success(`ลบพาสคีย์ "${pk.label}" แล้ว`);
      await load();
      await onChanged();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'ลบไม่สำเร็จ');
    } finally {
      setRemoving(null);
    }
  }

  return (
    <div className="card">
      <div className="card-head">
        <h2 style={{ display: 'flex', alignItems: 'center', gap: 8, margin: 0 }}>
          <Fingerprint size={20} color="var(--orange-dark)" />
          พาสคีย์ของฉัน
        </h2>
        <button className="btn btn-outline" onClick={() => void add()} disabled={busy}>
          {busy ? 'กำลังเพิ่ม...' : '+ เพิ่มอุปกรณ์'}
        </button>
      </div>
      <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem' }}>
        เพิ่มไว้มากกว่าหนึ่งเครื่อง เผื่อเครื่องหนึ่งหายหรือพัง จะได้ไม่ต้องรอแอดมินรีเซ็ตให้
      </p>

      {list === null ? (
        <div className="empty-state">กำลังโหลด...</div>
      ) : list.length === 0 ? (
        <div className="empty-state">ยังไม่มีพาสคีย์</div>
      ) : (
        <div>
          {list.map((pk) => (
            <div className="passkey-row" key={pk.passkey_id}>
              <div>
                <div className="title">
                  <Fingerprint size={16} color="var(--orange-dark)" />
                  {pk.label}
                  {pk.backed_up && <span className="badge badge-approved">ซิงก์ข้ามเครื่อง</span>}
                </div>
                <div className="sub">
                  เพิ่มเมื่อ {thDateTime(pk.created_at)}
                  {pk.last_used_at ? ` · ใช้ล่าสุด ${thDateTime(pk.last_used_at)}` : ' · ยังไม่เคยใช้'}
                </div>
              </div>
              {list.length > 1 && (
                <button
                  className="btn btn-outline btn-sm"
                  onClick={() => setRemoving(pk)}
                  aria-label={`ลบพาสคีย์ ${pk.label}`}
                >
                  <Trash2 size={16} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {removing && (
        <Dialog title="ลบพาสคีย์" onClose={() => setRemoving(null)}>
          <div className="confirm-summary">
            ต้องการลบพาสคีย์
            <br />
            <strong>{removing.label}</strong>
            <br />
            <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
              อุปกรณ์เครื่องนั้นจะเข้าสู่ระบบไม่ได้อีก · เหลืออีก {list ? list.length - 1 : 0} อัน
            </span>
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void remove(removing);
            }}
          >
            <DialogActions confirmLabel="ยืนยันลบ" onCancel={() => setRemoving(null)} danger />
          </form>
        </Dialog>
      )}
    </div>
  );
}

/**
 * A default label so the list is not three rows all called the same thing.
 * Only a hint from the user agent — the person can be more specific by
 * enrolling from the first-run screen, which asks.
 */
function deviceGuess(): string {
  const ua = typeof navigator === 'undefined' ? '' : navigator.userAgent;
  if (/iPhone|iPad/.test(ua)) return 'iPhone/iPad';
  if (/Android/.test(ua)) return 'Android';
  if (/Macintosh/.test(ua)) return 'Mac';
  if (/Windows/.test(ua)) return 'Windows';
  return 'อุปกรณ์ของฉัน';
}
