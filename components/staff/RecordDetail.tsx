'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { api } from '@/app/lib/api';
import { statusBadgeClass, thDate } from '@/app/lib/format';
import BackLink from './BackLink';
import type { LoanRecord } from '@/app/lib/types';

/** A row of the loan history opened in full, the way a request opens in full. */
export default function RecordDetail({ recordId }: { recordId: string }) {
  const [record, setRecord] = useState<LoanRecord | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    api<{ record: LoanRecord }>(`/api/records/${recordId}`)
      .then((d) => setRecord(d.record))
      .catch((e) => {
        setFailed(true);
        toast.error(e instanceof Error ? e.message : 'โหลดรายการไม่สำเร็จ');
      });
  }, [recordId]);

  if (failed) {
    return (
      <>
        <BackLink href="/staff/history" />
        <div className="card">
          <div className="empty-state">ไม่พบรายการยืมนี้</div>
        </div>
      </>
    );
  }

  if (!record) {
    return (
      <>
        <BackLink href="/staff/history" />
        <div className="card">
          <div className="empty-state">กำลังโหลด...</div>
        </div>
      </>
    );
  }

  const late =
    record.return_date && record.due_date
      ? new Date(record.return_date) > new Date(record.due_date)
      : false;

  return (
    <>
      <BackLink href="/staff/history" />

      <div className="card">
        <div className="card-head">
          <h1>{record.equipment_name}</h1>
          <span className={statusBadgeClass(record.status)}>{record.status}</span>
        </div>

        <dl className="detail-grid">
          <div>
            <dt>รหัสรายการ</dt>
            <dd>{record.record_id}</dd>
          </div>
          <div>
            <dt>ผู้ยืม</dt>
            <dd>
              <Link className="row-link" href={`/staff/borrowers/${record.borrower_id}`}>
                {record.borrower_name}
              </Link>
            </dd>
          </div>
          <div>
            <dt>รหัสอุปกรณ์</dt>
            <dd>{record.equipment_id}</dd>
          </div>
          <div>
            <dt>วันที่ยืม</dt>
            <dd>{thDate(record.borrow_date)}</dd>
          </div>
          <div>
            <dt>กำหนดคืน</dt>
            <dd>{record.due_date ? thDate(record.due_date) : 'ไม่ได้กำหนด'}</dd>
          </div>
          <div>
            <dt>วันที่คืนจริง</dt>
            <dd>
              {record.return_date ? thDate(record.return_date) : 'ยังไม่คืน'}
              {late && <span className="badge badge-overdue" style={{ marginLeft: 8 }}>คืนช้า</span>}
            </dd>
          </div>
          <div>
            <dt>เจ้าหน้าที่ที่จ่ายอุปกรณ์</dt>
            <dd>{record.handled_by_name || '-'}</dd>
          </div>
          <div>
            <dt>เจ้าหน้าที่ที่รับคืน</dt>
            <dd>{record.received_by_name || '-'}</dd>
          </div>
          <div>
            <dt>ที่มาของรายการ</dt>
            <dd>{record.source || '-'}</dd>
          </div>
          <div className="detail-wide">
            <dt>สภาพตอนรับคืน</dt>
            <dd>{record.condition_on_return || '-'}</dd>
          </div>
        </dl>
      </div>
    </>
  );
}
