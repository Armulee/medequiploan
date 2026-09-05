'use client';

import { Fingerprint } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import Dialog, { DialogActions } from '@/components/Dialog';
import { api, apiJson } from '@/app/lib/api';
import { thDateTime } from '@/app/lib/format';
import { actionLabel } from './actionLabels';
import BackLink from './BackLink';
import { ListCount, ListMore, PAGE_SIZE, useInfiniteList } from './InfiniteList';
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
  const [confirmOff, setConfirmOff] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  // Shown once, then gone. Never re-readable — the server only hashes it.
  const [temporary, setTemporary] = useState<string | null>(null);

  const load = useCallback(() => {
    api<{ user: StaffUser }>(`/api/users/${userId}`)
      .then((d) => setUser(d.user))
      .catch((e) => {
        setFailed(true);
        toast.error(e instanceof Error ? e.message : 'โหลดข้อมูลบัญชีไม่สำเร็จ');
      });
  }, [userId]);

  useEffect(load, [load]);

  // Admin-only, exactly like the Audit Log tab: staff never see this page.
  const fetchActivity = useCallback(
    async (offset: number, limit: number) => {
      const d = await api<{ audit_log: AuditEntry[]; total: number }>(
        `/api/audit-log?actor_user_id=${encodeURIComponent(userId)}&limit=${limit}&offset=${offset}`
      );
      return { items: d.audit_log, total: d.total };
    },
    [userId]
  );

  const {
    items: activity,
    total: activityTotal,
    loadingMore,
    sentinelRef,
  } = useInfiniteList(fetchActivity, PAGE_SIZE);

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

  /**
   * The way back in for someone who lost the device holding their passkey.
   *
   * Deliberately heavy: it wipes every passkey on the account, ends every
   * session it has open, and hands back a one-time password. If the phone was
   * stolen rather than mislaid, whoever has it is signed out by the same
   * click.
   */
  async function resetPasskeys() {
    try {
      const d = await apiJson<{ temporary_password: string; removed: number }>(
        `/api/users/${userId}/reset-passkeys`,
        'POST'
      );
      setTemporary(d.temporary_password);
      toast.success(`ลบพาสคีย์ ${d.removed} อัน และออกรหัสผ่านชั่วคราวแล้ว`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'รีเซ็ตไม่สำเร็จ');
    } finally {
      setConfirmReset(false);
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
            <>
              <button
                className="btn btn-outline"
                onClick={() => setConfirmReset(true)}
                style={{ display: 'flex', alignItems: 'center', gap: 6 }}
              >
                <Fingerprint size={16} />
                รีเซ็ตพาสคีย์
              </button>
              <button className="btn btn-outline" onClick={() => setConfirmOff(true)}>
                ปิดใช้งานบัญชีนี้
              </button>
            </>
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
          <>
          <ListCount shown={activity.length} total={activityTotal} />
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
          <ListMore
            sentinelRef={sentinelRef}
            loading={loadingMore}
            shown={activity.length}
            total={activityTotal}
          />
          </>
        )}
      </div>

      {confirmReset && (
        <Dialog title="รีเซ็ตพาสคีย์" onClose={() => setConfirmReset(false)}>
          <div className="confirm-summary">
            ต้องการรีเซ็ตพาสคีย์ของ
            <br />
            <strong>{user.name}</strong> ({user.username})
            <br />
            <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
              พาสคีย์ทุกอันของบัญชีนี้จะถูกลบ · ทุกเครื่องที่ยังเปิดค้างไว้จะถูกให้ออกจากระบบทันที ·
              ระบบจะออกรหัสผ่านชั่วคราวให้อ่านให้เจ้าตัวฟังหนึ่งครั้ง แล้วเขาต้องสร้างพาสคีย์ใหม่ก่อนใช้งานต่อ
            </span>
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void resetPasskeys();
            }}
          >
            <DialogActions
              confirmLabel="ยืนยันรีเซ็ตพาสคีย์"
              onCancel={() => setConfirmReset(false)}
              danger
            />
          </form>
        </Dialog>
      )}

      {temporary && (
        <Dialog title="รหัสผ่านชั่วคราว" onClose={() => setTemporary(null)}>
          <p style={{ marginTop: 0 }}>
            อ่านรหัสนี้ให้ <strong>{user.name}</strong> ฟัง แล้วให้เขาเข้าสู่ระบบด้วยรหัสผ่าน
            แล้วสร้างพาสคีย์ใหม่ทันที
          </p>
          <div className="temp-password">{temporary}</div>
          <p className="hint" style={{ marginTop: 10 }}>
            หน้านี้คือที่เดียวที่รหัสนี้จะปรากฏ · ปิดแล้วดูซ้ำไม่ได้ ต้องรีเซ็ตใหม่
            · อย่าส่งทางแชตที่เก็บข้อความไว้ถาวร
          </p>
          {/* One button, not DialogActions: there is nothing to cancel — the
              reset already happened, and this is the only chance to read it. */}
          <div className="dialog-actions">
            <button type="button" className="btn btn-primary" onClick={() => setTemporary(null)}>
              บันทึกไว้แล้ว ปิดหน้าต่างนี้
            </button>
          </div>
        </Dialog>
      )}

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
