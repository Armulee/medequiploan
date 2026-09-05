'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { api } from '@/app/lib/api';
import { statusBadgeClass, thDate, thDateTime } from '@/app/lib/format';
import BackLink from './BackLink';
import type { BorrowerFull, LoanRecord } from '@/app/lib/types';

/**
 * Everything held about one borrower, opened from anywhere their name appears.
 * The approve and reject actions are passed in so the same panel serves both
 * the request queue (where a decision is pending) and plain browsing.
 */
export default function BorrowerDetail({
  borrowerId,
  backHref,
  backLabel,
  actions,
  requestStatus,
}: {
  borrowerId: string;
  backHref: string;
  backLabel?: string;
  actions?: React.ReactNode;
  /** Shown by the request queue, where the decision is what the reader came for. */
  requestStatus?: string;
}) {
  const [borrower, setBorrower] = useState<BorrowerFull | null>(null);
  const [records, setRecords] = useState<LoanRecord[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    api<{ borrower: BorrowerFull }>(`/api/borrowers/${borrowerId}`)
      .then((d) => setBorrower(d.borrower))
      .catch((e) => {
        setFailed(true);
        toast.error(e instanceof Error ? e.message : 'โหลดข้อมูลผู้ยืมไม่สำเร็จ');
      });
    api<{ records: LoanRecord[] }>(`/api/records?borrower_id=${encodeURIComponent(borrowerId)}`)
      .then((d) => setRecords(d.records))
      .catch(() => setRecords([]));
  }, [borrowerId]);

  if (failed) {
    return (
      <>
        <BackLink href={backHref}>{backLabel}</BackLink>
        <div className="card">
          <div className="empty-state">ไม่พบข้อมูลผู้ยืมรายนี้</div>
        </div>
      </>
    );
  }

  if (!borrower) {
    return (
      <>
        <BackLink href={backHref}>{backLabel}</BackLink>
        <div className="card">
          <div className="empty-state">กำลังโหลด...</div>
        </div>
      </>
    );
  }

  const judged = (records ?? []).filter((r) => r.return_date && r.due_date);
  const onTime = judged.filter((r) => new Date(r.return_date!) <= new Date(r.due_date!)).length;

  return (
    <>
      <BackLink href={backHref}>{backLabel}</BackLink>

      <div className="card">
        <div className="card-head">
          <h1>
            {borrower.first_name} {borrower.last_name}
          </h1>
          {/* Opened from the request queue this shows the decision. Opened
              from anywhere else there is no request, so it says how the
              borrower got here instead — which is all `verified` records now
              that registration no longer photographs an ID card. */}
          {requestStatus ? (
            <span className={statusBadgeClass(requestStatus)}>{requestStatus}</span>
          ) : (
            <span className={borrower.verified ? 'badge badge-approved' : 'badge badge-pending'}>
              {borrower.verified ? 'ลงทะเบียนโดยเจ้าหน้าที่' : 'มาจากฟอร์มออนไลน์'}
            </span>
          )}
        </div>

        <dl className="detail-grid">
          <div>
            <dt>รหัสผู้ยืม</dt>
            <dd>{borrower.borrower_id}</dd>
          </div>
          <div>
            <dt>เลขบัตรประชาชน</dt>
            <dd>{borrower.national_id}</dd>
          </div>
          <div>
            <dt>เบอร์โทรศัพท์</dt>
            <dd>
              {borrower.phone ? <a href={`tel:${borrower.phone}`}>{borrower.phone}</a> : '-'}
            </dd>
          </div>
          <div>
            <dt>LINE ID</dt>
            <dd>{borrower.line_id || '-'}</dd>
          </div>
          <div>
            <dt>อีเมล</dt>
            <dd>{borrower.email || '-'}</dd>
          </div>
          <div>
            <dt>ลงทะเบียนเมื่อ</dt>
            <dd>{thDateTime(borrower.registered_at)}</dd>
          </div>
          <div className="detail-wide">
            <dt>ที่อยู่</dt>
            <dd>{borrower.address}</dd>
          </div>
          <div className="detail-wide">
            <dt>อาการ / เหตุผลที่ต้องใช้อุปกรณ์</dt>
            <dd>{borrower.illness_description || '-'}</dd>
          </div>
          <div className="detail-wide">
            <dt>ความยินยอม PDPA</dt>
            <dd>
              {borrower.consent_accepted_at
                ? `ยินยอมแล้ว (เวอร์ชัน ${borrower.consent_version}) เมื่อ ${thDateTime(borrower.consent_accepted_at)}`
                : 'ยังไม่มีบันทึกความยินยอม'}
            </dd>
          </div>
        </dl>

        {actions && <div className="detail-actions">{actions}</div>}
      </div>

      {(borrower.id_card_photo_url || borrower.illness_photo_url) && (
        <div className="card">
          <h2>เอกสารแนบ</h2>
          <p style={{ color: 'var(--text-muted)', marginTop: -6 }}>
            เป็นข้อมูลสุขภาพ เห็นได้เฉพาะเจ้าหน้าที่ที่เข้าสู่ระบบ
          </p>
          <div className="photo-grid">
            {borrower.id_card_photo_url && (
              <figure>
                <img src={borrower.id_card_photo_url} alt="รูปบัตรประชาชน" />
                <figcaption>รูปบัตรประชาชน</figcaption>
              </figure>
            )}
            {borrower.illness_photo_url && (
              <figure>
                <img src={borrower.illness_photo_url} alt="รูปอาการป่วย" />
                <figcaption>รูปอาการป่วย</figcaption>
              </figure>
            )}
          </div>
        </div>
      )}

      <div className="card">
        <h2>ประวัติการยืม</h2>
        {records === null ? (
          <div className="empty-state">กำลังโหลด...</div>
        ) : records.length === 0 ? (
          <div className="empty-state">ยังไม่มีประวัติการยืม</div>
        ) : (
          <>
            {judged.length > 0 && (
              <div className="stat-inline">
                คืนตรงเวลา <strong>{Math.round((onTime / judged.length) * 100)}%</strong> ({onTime}/
                {judged.length} รายการที่มีกำหนดคืน)
              </div>
            )}
            <div className="list">
              {records.map((r) => (
                <Link className="list-row clickable" key={r.record_id} href={`/staff/records/${r.record_id}`}>
                  <div>
                    <div className="title">{r.equipment_name}</div>
                    <div className="sub">
                      ยืม {thDate(r.borrow_date)}
                      {r.due_date ? ` · ครบกำหนด ${thDate(r.due_date)}` : ''}
                      {r.return_date ? ` · คืน ${thDate(r.return_date)}` : ''}
                    </div>
                  </div>
                  <span className={statusBadgeClass(r.status)}>{r.status}</span>
                </Link>
              ))}
            </div>
          </>
        )}
      </div>
    </>
  );
}
