'use client';

import { useEffect, useState } from 'react';
import Alert from '@/components/Alert';
import Icon from '@/components/Icon';
import { api } from '@/app/lib/api';
import { statusBadgeClass, thDate, thDateTime } from '@/app/lib/format';
import type { BorrowerFull, LoanRecord } from '@/app/lib/types';

/**
 * Everything held about one borrower, opened from anywhere their name appears.
 * The approve and reject actions are passed in so the same panel serves both
 * the request queue (where a decision is pending) and plain browsing.
 */
export default function BorrowerDetail({
  borrowerId,
  onBack,
  actions,
}: {
  borrowerId: string;
  onBack: () => void;
  actions?: React.ReactNode;
}) {
  const [borrower, setBorrower] = useState<BorrowerFull | null>(null);
  const [records, setRecords] = useState<LoanRecord[] | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api<{ borrower: BorrowerFull }>(`/api/borrowers/${borrowerId}`)
      .then((d) => setBorrower(d.borrower))
      .catch((e) => setError(e instanceof Error ? e.message : 'โหลดข้อมูลผู้ยืมไม่สำเร็จ'));
    api<{ records: LoanRecord[] }>(`/api/records?borrower_id=${encodeURIComponent(borrowerId)}`)
      .then((d) => setRecords(d.records))
      .catch(() => setRecords([]));
  }, [borrowerId]);

  if (error) {
    return (
      <div className="card">
        <button className="back-link" onClick={onBack}>
          <Icon name="chevron-left" size={20} strokeWidth={2.5} />
          กลับ
        </button>
        <Alert kind="error">{error}</Alert>
      </div>
    );
  }

  if (!borrower) {
    return (
      <div className="card">
        <div className="empty-state">กำลังโหลด...</div>
      </div>
    );
  }

  const judged = (records ?? []).filter((r) => r.return_date && r.due_date);
  const onTime = judged.filter((r) => new Date(r.return_date!) <= new Date(r.due_date!)).length;

  return (
    <>
      <button className="back-link" onClick={onBack}>
        <Icon name="chevron-left" size={20} strokeWidth={2.5} />
        กลับ
      </button>

      <div className="card">
        <div className="card-head">
          <h1>
            {borrower.first_name} {borrower.last_name}
          </h1>
          <span className={borrower.verified ? 'badge badge-approved' : 'badge badge-pending'}>
            {borrower.verified ? 'ยืนยันตัวตนแล้ว' : 'ยังไม่ยืนยันตัวตน'}
          </span>
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
                <div className="list-row" key={r.record_id}>
                  <div>
                    <div className="title">{r.equipment_name}</div>
                    <div className="sub">
                      ยืม {thDate(r.borrow_date)}
                      {r.due_date ? ` · ครบกำหนด ${thDate(r.due_date)}` : ''}
                      {r.return_date ? ` · คืน ${thDate(r.return_date)}` : ''}
                    </div>
                  </div>
                  <span className={statusBadgeClass(r.status)}>{r.status}</span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </>
  );
}
