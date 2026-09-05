'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { api } from '@/app/lib/api';
import { statusBadgeClass } from '@/app/lib/format';
import BackLink from './BackLink';
import BorrowerDetail from './BorrowerDetail';
import DecisionDialog, { type Decision } from './DecisionDialog';
import type { BorrowRequest } from '@/app/lib/types';

/**
 * One request, decided from the borrower's own page: what they asked for, who
 * they are, and everything they have borrowed before, all on one screen.
 */
export default function RequestDetail({ requestId }: { requestId: string }) {
  const [request, setRequest] = useState<BorrowRequest | null>(null);
  const [failed, setFailed] = useState(false);
  const [decision, setDecision] = useState<Decision | null>(null);

  const load = useCallback(() => {
    api<{ request: BorrowRequest }>(`/api/requests/${requestId}`)
      .then((d) => setRequest(d.request))
      .catch((e) => {
        setFailed(true);
        toast.error(e instanceof Error ? e.message : 'โหลดคำขอไม่สำเร็จ');
      });
  }, [requestId]);

  useEffect(load, [load]);

  if (failed || !request) {
    return (
      <>
        <BackLink href="/staff/requests" />
        <div className="card">
          <div className="empty-state">{failed ? 'ไม่พบคำขอนี้' : 'กำลังโหลด...'}</div>
        </div>
      </>
    );
  }

  const pending = request.status === 'รอดำเนินการ';

  return (
    <>
      <BorrowerDetail
        borrowerId={request.borrower_id}
        backHref="/staff/requests"
        backLabel="กลับไปที่คำขอ"
        requestStatus={request.status}
        actions={
          pending ? (
            <>
              <div className="detail-ask">
                ขอยืม <strong>{request.equipment_name}</strong>
                {request.note ? ` · ${request.note}` : ''}
              </div>
              <button
                className="btn btn-primary"
                onClick={() => setDecision({ request, kind: 'approve' })}
              >
                อนุมัติคำขอ {request.request_id}
              </button>
              <button
                className="btn btn-outline"
                onClick={() => setDecision({ request, kind: 'reject' })}
              >
                ปฏิเสธคำขอ
              </button>
            </>
          ) : (
            <span className={statusBadgeClass(request.status)}>
              คำขอ {request.request_id} ({request.equipment_name}): {request.status}
            </span>
          )
        }
      />
      {decision && (
        <DecisionDialog
          decision={decision}
          onClose={() => setDecision(null)}
          onDone={() => {
            setDecision(null);
            // Stay on the page: the badge and the actions both change, and the
            // borrower's loan history has just gained a row.
            load();
          }}
        />
      )}
    </>
  );
}
