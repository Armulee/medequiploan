'use client';

import { ChevronRight, Search } from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import Dialog, { DialogActions } from '@/components/Dialog';
import { api, apiJson } from '@/app/lib/api';
import { thDate } from '@/app/lib/format';
import type { SessionUser, StaffUser } from '@/app/lib/types';

type SortKey = 'created_desc' | 'created_asc' | 'name_asc';

export default function UsersTab({ currentUser }: { currentUser: SessionUser }) {
  const [users, setUsers] = useState<StaffUser[] | null>(null);
  const [adding, setAdding] = useState(false);
  const [confirmOff, setConfirmOff] = useState<StaffUser | null>(null);

  const [search, setSearch] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [sort, setSort] = useState<SortKey>('created_desc');

  const load = useCallback(() => {
    api<{ users: StaffUser[] }>('/api/users')
      .then((d) => setUsers(d.users))
      .catch((e) => {
        setUsers([]);
        toast.error(e instanceof Error ? e.message : 'โหลดรายชื่อไม่สำเร็จ');
      });
  }, []);

  useEffect(load, [load]);

  // Filtering and sorting happen here rather than server-side: this list is a
  // handful of people, so a round trip per keystroke would be wasted.
  const shown = useMemo(() => {
    if (!users) return null;
    const term = search.trim().toLowerCase();
    const fromTime = from ? new Date(from).getTime() : null;
    // Inclusive of the whole end day, which is what picking a date means.
    const toTime = to ? new Date(to).getTime() + 24 * 60 * 60 * 1000 - 1 : null;

    const filtered = users.filter((u) => {
      if (term && !`${u.name} ${u.username}`.toLowerCase().includes(term)) return false;
      const created = new Date(u.created_at).getTime();
      if (fromTime !== null && created < fromTime) return false;
      if (toTime !== null && created > toTime) return false;
      return true;
    });

    return [...filtered].sort((a, b) => {
      if (sort === 'name_asc') return a.name.localeCompare(b.name, 'th');
      const diff = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      return sort === 'created_asc' ? diff : -diff;
    });
  }, [users, search, from, to, sort]);

  async function deactivate(u: StaffUser) {
    try {
      await apiJson(`/api/users/${u.user_id}`, 'DELETE');
      toast.success(`ปิดการใช้งานบัญชี ${u.username} แล้ว`);
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'ปิดการใช้งานไม่สำเร็จ');
    } finally {
      setConfirmOff(null);
    }
  }

  async function reactivate(u: StaffUser) {
    try {
      await apiJson(`/api/users/${u.user_id}`, 'PATCH', { active: true });
      toast.success(`เปิดใช้งานบัญชี ${u.username} อีกครั้งแล้ว`);
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'เปิดใช้งานไม่สำเร็จ');
    }
  }

  return (
    <>
      <div className="card">
        {/* card-head-row keeps the heading and the button on one line even on
            a phone, where the stacked default put a full-width button under
            the title and pushed the whole list down. */}
        <div className="card-head card-head-row">
          <h1>เจ้าหน้าที่</h1>
          <button className="btn btn-sm btn-primary" onClick={() => setAdding(true)}>
            + เพิ่มเจ้าหน้าที่
          </button>
        </div>

        <div className="toolbar">
          <div className="field">
            <label htmlFor="u_search">
              <Search size={15} /> ค้นหา
            </label>
            <input
              id="u_search"
              type="search"
              placeholder="ชื่อ หรือชื่อผู้ใช้"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="u_from">สร้างตั้งแต่</label>
            <input id="u_from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="u_to">ถึง</label>
            <input id="u_to" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="u_sort">เรียงตาม</label>
            <select id="u_sort" value={sort} onChange={(e) => setSort(e.target.value as SortKey)}>
              <option value="created_desc">เพิ่มล่าสุดก่อน</option>
              <option value="created_asc">เพิ่มเก่าสุดก่อน</option>
              <option value="name_asc">ชื่อ ก-ฮ</option>
            </select>
          </div>
        </div>

        {shown === null ? (
          <div className="empty-state">กำลังโหลด...</div>
        ) : shown.length === 0 ? (
          <div className="empty-state">ไม่พบเจ้าหน้าที่ตามเงื่อนไขที่เลือก</div>
        ) : (
          <div className="list">
            {shown.map((u) => (
              <div className="list-row" key={u.user_id}>
                <div>
                  <div className="title">
                    <Link className="row-link" href={`/staff/users/${u.user_id}`}>
                      {u.name}
                    </Link>
                    <span className={`badge ${u.role === 'admin' ? 'badge-approved' : 'badge-active'}`}>
                      {u.role === 'admin' ? 'แอดมิน' : 'เจ้าหน้าที่'}
                    </span>
                    {!u.active && <span className="badge badge-rejected">ปิดใช้งาน</span>}
                    {u.user_id === currentUser.user_id && (
                      <span className="badge badge-pending">คุณ</span>
                    )}
                  </div>
                  <div className="sub">
                    {u.username} · {u.user_id} · เพิ่มเมื่อ {thDate(u.created_at)}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  {u.active ? (
                    <button
                      className="btn btn-sm btn-outline"
                      disabled={u.user_id === currentUser.user_id}
                      onClick={() => setConfirmOff(u)}
                    >
                      ปิดใช้งาน
                    </button>
                  ) : (
                    <button className="btn btn-sm btn-primary" onClick={() => void reactivate(u)}>
                      เปิดใช้งาน
                    </button>
                  )}
                  <Link
                    className="icon-btn"
                    href={`/staff/users/${u.user_id}`}
                    aria-label={`ดูรายละเอียดของ ${u.name}`}
                  >
                    <ChevronRight size={18} />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {adding && (
        <AddUserDialog
          onClose={() => setAdding(false)}
          onDone={() => {
            setAdding(false);
            load();
          }}
        />
      )}

      {confirmOff && (
        <Dialog title="ปิดการใช้งานบัญชี" onClose={() => setConfirmOff(null)}>
          <div className="confirm-summary">
            ต้องการปิดการใช้งานบัญชี
            <br />
            <strong>{confirmOff.name}</strong> ({confirmOff.username})
            <br />
            <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
              บัญชีจะเข้าสู่ระบบไม่ได้อีก แต่ประวัติการทำรายการที่ผ่านมายังอยู่ครบ
              และเปิดใช้งานกลับได้ภายหลัง
            </span>
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void deactivate(confirmOff);
            }}
          >
            <DialogActions confirmLabel="ยืนยันปิดใช้งาน" onCancel={() => setConfirmOff(null)} danger />
          </form>
        </Dialog>
      )}
    </>
  );
}

function AddUserDialog({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [form, setForm] = useState({ name: '', username: '', password: '', role: 'staff' });
  // Inline, because it is about the password field two rows above it.
  const [invalid, setInvalid] = useState('');
  const [busy, setBusy] = useState(false);

  const set =
    (k: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm((f) => ({ ...f, [k]: e.target.value }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setInvalid('');
    if (form.password.length < 8) return setInvalid('รหัสผ่านต้องยาวอย่างน้อย 8 ตัวอักษร');
    setBusy(true);
    try {
      await apiJson('/api/users', 'POST', form);
      toast.success(`เพิ่มเจ้าหน้าที่ ${form.name} แล้ว`);
      onDone();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'เพิ่มเจ้าหน้าที่ไม่สำเร็จ');
      setBusy(false);
    }
  }

  return (
    <Dialog title="เพิ่มเจ้าหน้าที่" onClose={onClose}>
      <form onSubmit={submit}>
        <div className="field">
          <label htmlFor="nu_name">ชื่อ-นามสกุล *</label>
          <input id="nu_name" type="text" value={form.name} onChange={set('name')} required autoFocus />
        </div>
        <div className="field">
          <label htmlFor="nu_username">ชื่อผู้ใช้ (สำหรับเข้าสู่ระบบ) *</label>
          <input
            id="nu_username"
            type="text"
            value={form.username}
            onChange={(e) =>
              setForm((f) => ({ ...f, username: e.target.value.toLowerCase().replace(/[^a-z0-9._-]/g, '') }))
            }
            required
          />
          <div className="hint">ตัวอักษรอังกฤษพิมพ์เล็ก ตัวเลข . _ - เท่านั้น</div>
        </div>
        <div className="field">
          <label htmlFor="nu_password">รหัสผ่านเริ่มต้น *</label>
          <input
            id="nu_password"
            type="text"
            value={form.password}
            onChange={set('password')}
            required
          />
          <div className={invalid ? 'hint hint-error' : 'hint'}>
            {invalid || 'อย่างน้อย 8 ตัวอักษร · แจ้งเจ้าหน้าที่ให้เปลี่ยนหลังเข้าใช้ครั้งแรก'}
          </div>
        </div>
        <div className="field">
          <label htmlFor="nu_role">สิทธิ์ *</label>
          <select id="nu_role" value={form.role} onChange={set('role')}>
            <option value="staff">เจ้าหน้าที่ — ลงทะเบียน ยืม-คืน อนุมัติคำขอ</option>
            <option value="admin">แอดมิน — เพิ่มได้ทุกอย่าง รวมจัดการสต็อกและเจ้าหน้าที่</option>
          </select>
        </div>
        <DialogActions confirmLabel="เพิ่มเจ้าหน้าที่" onCancel={onClose} busy={busy} />
      </form>
    </Dialog>
  );
}
