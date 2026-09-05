'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { api } from '@/app/lib/api';
import { statusBadgeClass, thDate, thDateTime } from '@/app/lib/format';
import BackLink from './BackLink';
import { ListCount, ListMore, PAGE_SIZE, useInfiniteList } from './InfiniteList';
import type { BorrowerFull, LoanRecord, OnTimeRate } from '@/app/lib/types';

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
  extra,
  requestStatus,
  refreshKey = 0,
  onLoaded,
}: {
  borrowerId: string;
  backHref: string;
  backLabel?: string;
  actions?: React.ReactNode;
  /** Rendered between the record and its attachments — the request queue puts
      what the submission claimed there, where it is read before the photos. */
  extra?: React.ReactNode;
  /** Shown by the request queue, where the decision is what the reader came for. */
  requestStatus?: string;
  /** Bumped by the parent after lending, so the loan list below reflects it. */
  refreshKey?: number;
  /** The parent needs the name for its own dialogs, and only this fetch has it. */
  onLoaded?: (borrower: BorrowerFull) => void;
}) {
  const [borrower, setBorrower] = useState<BorrowerFull | null>(null);
  const [rate, setRate] = useState<OnTimeRate | null>(null);
  const [failed, setFailed] = useState(false);

  // Held in a ref so an inline arrow from the parent does not re-run the fetch
  // on every render.
  const loaded = useRef(onLoaded);
  loaded.current = onLoaded;

  useEffect(() => {
    api<{ borrower: BorrowerFull; on_time: OnTimeRate }>(`/api/borrowers/${borrowerId}`)
      .then((d) => {
        setBorrower(d.borrower);
        setRate(d.on_time);
        loaded.current?.(d.borrower);
      })
      .catch((e) => {
        setFailed(true);
        toast.error(e instanceof Error ? e.message : 'โหลดข้อมูลผู้ยืมไม่สำเร็จ');
      });
  }, [borrowerId, refreshKey]);

  // The list below is paged; the rate above it is counted by the server over
  // every closed loan, so scrolling does not change it.
  const fetchPage = useCallback(
    async (offset: number, limit: number) => {
      const d = await api<{ records: LoanRecord[]; total: number }>(
        `/api/records?borrower_id=${encodeURIComponent(borrowerId)}&limit=${limit}&offset=${offset}`
      );
      return { items: d.records, total: d.total };
    },
    // refreshKey: lending from this page adds a row to the list below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [borrowerId, refreshKey]
  );

  const { items: records, total, loadingMore, sentinelRef } = useInfiniteList(fetchPage, PAGE_SIZE);

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
              borrower got here instead: `verified` means a staff member
              registered them in person, not that the card has been checked —
              both routes now carry a card photograph. */}
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

      {extra}

      {(borrower.id_card_photo_url || borrower.illness_photo_url) && (
        <div className="card">
          <h2>เอกสารแนบ</h2>
          <p style={{ color: 'var(--text-muted)', marginTop: -6 }}>
            เป็นข้อมูลส่วนบุคคลและข้อมูลสุขภาพ เห็นได้เฉพาะเจ้าหน้าที่ที่เข้าสู่ระบบ · กดที่รูปเพื่อดูขนาดเต็ม
          </p>
          <div className="photo-grid">
            {borrower.id_card_photo_url && (
              <figure>
                {/* A link, because reading the small print on a card in a
                    220px column is not possible; /api/files checks the
                    session either way. */}
                <a href={borrower.id_card_photo_url} target="_blank" rel="noreferrer">
                  <img src={borrower.id_card_photo_url} alt="รูปบัตรประชาชน" />
                </a>
                <figcaption>
                  รูปบัตรประชาชน · เทียบกับเลขที่กรอกไว้: <strong>{borrower.national_id}</strong>
                </figcaption>
              </figure>
            )}
            {borrower.illness_photo_url && (
              <figure>
                <a href={borrower.illness_photo_url} target="_blank" rel="noreferrer">
                  <img src={borrower.illness_photo_url} alt="รูปอาการป่วย" />
                </a>
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
            {rate && rate.judged > 0 && (
              <div className="stat-inline">
                คืนตรงเวลา <strong>{Math.round((rate.on_time / rate.judged) * 100)}%</strong> (
                {rate.on_time}/{rate.judged} รายการที่มีกำหนดคืน)
              </div>
            )}
            <ListCount shown={records.length} total={total} />
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
            <ListMore
              sentinelRef={sentinelRef}
              loading={loadingMore}
              shown={records.length}
              total={total}
            />
          </>
        )}
      </div>
    </>
  );
}
