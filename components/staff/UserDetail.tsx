'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import Dialog, { DialogActions } from '@/components/Dialog';
import { api, apiJson } from '@/app/lib/api';
import { thDateTime } from '@/app/lib/format';
import { actionLabel } from './actionLabels';
import BackLink from './BackLink';
import type { AuditEntry, SessionUser, StaffUser } from '@/app/lib/types';

/**
 * One staff account in full, with what that account has actually done. The
 * list can only ever show a name and a role; deciding whether to close an
 * account needs the rest.
 */
export default function UserDetail({
  userId,
  currentUser,
}: {
  userId: string;
  currentUser: SessionUser;
}) {
  const [user, setUser] = useState<StaffUser | null>(null);
  const [failed, setFailed] = useState(false);
  const [activity, setActivity] = useState<AuditEntry[] | null>(null);
  const [confirmOff, setConfirmOff] = useState(false);

  const load = useCallback(() => {
    api<{ user: StaffUser }>(`/api/users/${userId}`)
      .then((d) => setUser(d.user))
      .catch((e) => {
        setFailed(true);
        toast.error(e instanceof Error ? e.message : 'โหลดข้อมูลบัญชีไม่สำเร็จ');
      });
  }, [userId]);

  useEffect(load, [load]);

  useEffect(() => {
    // Admin-only, exactly like the Audit Log tab: staff never see this page.
    api<{ audit_log: AuditEntry[] }>(
      `/api/audit-log?limit=50&actor_user_id=${encodeURIComponent(userId)}`
    )
      .then((d) => setActivity(d.audit_log))
      .catch(() => setActivity([]));
  }, [userId]);

  async function setActive(active: boolean) {
    try {
      if (active) {
        await apiJson(`/api/users/${userId}`, 'PATCH', { active: true });
        toast.success(`เปิดใช้งานบัญชี ${user?.username ?? userId} อีกครั้งแล้ว`);
      } else {
        await apiJson(`/api/users/${userId}`, 'DELETE');
        toast.success(`ปิดการใช้งานบัญชี ${user?.username ?? userId} แล้ว`);
      }
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'บันทึกไม่สำเร็จ');
    } finally {
      setConfirmOff(false);
    }
  }

  if (failed || !user) {
    return (
      <>
        <BackLink href="/staff/users" />
        <div className="card">
          <div className="empty-state">{failed ? 'ไม่พบบัญชีนี้' : 'กำลังโหลด...'}</div>
        </div>
      </>
    );
  }

  const isSelf = user.user_id === currentUser.user_id;

  return (
    <>
      <BackLink href="/staff/users" />

      <div className="card">
        <div className="card-head">
          <h1>{user.name}</h1>
          <span className={`badge ${user.role === 'admin' ? 'badge-approved' : 'badge-active'}`}>
            {user.role === 'admin' ? 'แอดมิน' : 'เจ้าหน้าที่'}
          </span>
        </div>

        <dl className="detail-grid">
          <div>
            <dt>รหัสบัญชี</dt>
            <dd>{user.user_id}</dd>
          </div>
          <div>
            <dt>ชื่อผู้ใช้</dt>
            <dd>{user.username}</dd>
          </div>
          <div>
            <dt>สถานะ</dt>
            <dd>
              <span className={user.active ? 'badge badge-approved' : 'badge badge-rejected'}>
                {user.active ? 'ใช้งานอยู่' : 'ปิดใช้งาน'}
              </span>
            </dd>
          </div>
          <div>
            <dt>เพิ่มเมื่อ</dt>
            <dd>{thDateTime(user.created_at)}</dd>
          </div>
        </dl>

        <div className="detail-actions">
          {isSelf ? (
            // Closing your own account would lock you out mid-session, and the
            // API refuses it anyway.
            <span className="hint">นี่คือบัญชีของคุณ · แก้ชื่อและรหัสผ่านได้ที่หน้าตั้งค่าบัญชี</span>
          ) : user.active ? (
            <button className="btn btn-outline" onClick={() => setConfirmOff(true)}>
              ปิดใช้งานบัญชีนี้
            </button>
          ) : (
            <button className="btn btn-primary" onClick={() => void setActive(true)}>
              เปิดใช้งานบัญชีนี้
            </button>
          )}
        </div>
      </div>

      <div className="card">
        <h2>การกระทำล่าสุดของบัญชีนี้</h2>
        {activity === null ? (
          <div className="empty-state">กำลังโหลด...</div>
        ) : activity.length === 0 ? (
          <div className="empty-state">ยังไม่มีการกระทำที่บันทึกไว้</div>
        ) : (
          <div className="list">
            {activity.map((l) => (
              <div className="list-row" key={l.log_id}>
                <div>
                  <div className="title">{actionLabel(l.action)}</div>
                  <div className="sub">
                    {thDateTime(l.at)}
                    {l.target_id ? ` · ${l.target_type} ${l.target_id}` : ''}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {confirmOff && (
        <Dialog title="ปิดการใช้งานบัญชี" onClose={() => setConfirmOff(false)}>
          <div className="confirm-summary">
            ต้องการปิดการใช้งานบัญชี
            <br />
            <strong>{user.name}</strong> ({user.username})
            <br />
            <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
              บัญชีจะเข้าสู่ระบบไม่ได้อีก แต่ประวัติการทำรายการที่ผ่านมายังอยู่ครบ
              และเปิดใช้งานกลับได้ภายหลัง
            </span>
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void setActive(false);
            }}
          >
            <DialogActions confirmLabel="ยืนยันปิดใช้งาน" onCancel={() => setConfirmOff(false)} danger />
          </form>
        </Dialog>
      )}
    </>
  );
}
