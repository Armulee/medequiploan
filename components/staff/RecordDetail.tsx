'use client';

import { ChevronLeft } from 'lucide-react';
import { useState } from 'react';
import { statusBadgeClass, thDate, thDateTime } from '@/app/lib/format';
import BorrowerDetail from './BorrowerDetail';
import type { LoanRecord } from '@/app/lib/types';

/** A row of the loan history opened in full, the way a request opens in full. */
export default function RecordDetail({
  record,
  onBack,
}: {
  record: LoanRecord;
  onBack: () => void;
}) {
  const [showBorrower, setShowBorrower] = useState(false);

  if (showBorrower) {
    return <BorrowerDetail borrowerId={record.borrower_id} onBack={() => setShowBorrower(false)} />;
  }

  const late =
    record.return_date && record.due_date
      ? new Date(record.return_date) > new Date(record.due_date)
      : false;

  return (
    <>
      <button className="back-link" onClick={onBack}>
        <ChevronLeft size={20} strokeWidth={2.5} />
        กลับ
      </button>

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
              <button className="row-link" onClick={() => setShowBorrower(true)}>
                {record.borrower_name}
              </button>
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
