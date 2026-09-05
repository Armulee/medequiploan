'use client';

import { useCallback, useEffect, useState } from 'react';
import Alert from '@/components/Alert';
import Dialog, { DialogActions } from '@/components/Dialog';
import { Phone } from 'lucide-react';
import { api, apiJson } from '@/app/lib/api';
import { statusBadgeClass, thDateTime } from '@/app/lib/format';
import BorrowerDetail from './BorrowerDetail';
import type { BorrowRequest } from '@/app/lib/types';

const FILTERS = ['รอดำเนินการ', 'อนุมัติ', 'ปฏิเสธ', 'ทั้งหมด'] as const;

type Decision = { request: BorrowRequest; kind: 'approve' | 'reject' };

export default function RequestsTab({
  initialFilter,
}: {
  initialFilter?: (typeof FILTERS)[number];
}) {
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>(initialFilter ?? 'รอดำเนินการ');
  const [items, setItems] = useState<BorrowRequest[] | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [decision, setDecision] = useState<Decision | null>(null);
  const [viewing, setViewing] = useState<BorrowRequest | null>(null);

  const load = useCallback(() => {
    const qs = filter === 'ทั้งหมด' ? '' : `?status=${encodeURIComponent(filter)}`;
    setItems(null);
    api<{ requests: BorrowRequest[] }>(`/api/requests${qs}`)
      .then((d) => setItems(d.requests))
      .catch((e) => {
        setError(e instanceof Error ? e.message : 'โหลดคำขอไม่สำเร็จ');
        setItems([]);
      });
  }, [filter]);

  useEffect(load, [load]);

  function decided(message: string) {
    setSuccess(message);
    setDecision(null);
    setViewing(null);
    load();
  }

  // Viewing one borrower takes over the tab, so the queue keeps its filter and
  // scroll position when you come back.
  if (viewing) {
    return (
      <>
        <BorrowerDetail
          borrowerId={viewing.borrower_id}
          onBack={() => setViewing(null)}
          requestStatus={viewing.status}
          actions={
            viewing.status === 'รอดำเนินการ' ? (
              <>
                <button
                  className="btn btn-primary"
                  onClick={() => setDecision({ request: viewing, kind: 'approve' })}
                >
                  อนุมัติคำขอ {viewing.request_id}
                </button>
                <button
                  className="btn btn-outline"
                  onClick={() => setDecision({ request: viewing, kind: 'reject' })}
                >
                  ปฏิเสธคำขอ
                </button>
              </>
            ) : (
              <span className={statusBadgeClass(viewing.status)}>
                คำขอ {viewing.request_id}: {viewing.status}
              </span>
            )
          }
        />
        {decision && (
          <DecisionDialog
            decision={decision}
            onClose={() => setDecision(null)}
            onDone={decided}
            onError={setError}
          />
        )}
      </>
    );
  }

  return (
    <div className="card">
      <h1>คำขอยืมจากผู้ใช้ทั่วไป</h1>

      <div className="filter-row">
        {FILTERS.map((f) => (
          <button
            key={f}
            className={`btn btn-sm ${filter === f ? 'btn-primary' : 'btn-outline'}`}
            onClick={() => setFilter(f)}
          >
            {f}
          </button>
        ))}
      </div>

      <Alert kind="error">{error}</Alert>
      <Alert kind="success">{success}</Alert>

      {items === null ? (
        <div className="empty-state">กำลังโหลด...</div>
      ) : items.length === 0 ? (
        <div className="empty-state">ไม่มีคำขอในหมวดนี้</div>
      ) : (
        <div className="list">
          {items.map((r) => (
            <div className="list-row" key={r.request_id}>
              <div>
                <div className="title">
                  <button className="row-link" onClick={() => setViewing(r)}>
                    {r.borrower_name}
                  </button>
                  <span style={{ fontWeight: 400 }}>· {r.equipment_name}</span>
                </div>
                <div className="sub">
                  {r.request_id} · ส่งเมื่อ {thDateTime(r.requested_at)}
                  {r.note ? ` · ${r.note}` : ''}
                </div>
                {(r.borrower_phone || r.borrower_line_id) && (
                  <div className="sub contact-line">
                    <Phone size={14} />
                    {r.borrower_phone ? <a href={`tel:${r.borrower_phone}`}>{r.borrower_phone}</a> : '-'}
                    {r.borrower_line_id ? ` · LINE: ${r.borrower_line_id}` : ''}
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <span className={statusBadgeClass(r.status)}>{r.status}</span>
                {r.status === 'รอดำเนินการ' && (
                  <>
                    <button
                      className="btn btn-sm btn-primary"
                      onClick={() => setDecision({ request: r, kind: 'approve' })}
                    >
                      อนุมัติ
                    </button>
                    <button
                      className="btn btn-sm btn-outline"
                      onClick={() => setDecision({ request: r, kind: 'reject' })}
                    >
                      ปฏิเสธ
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {decision && (
        <DecisionDialog
          decision={decision}
          onClose={() => setDecision(null)}
          onDone={decided}
          onError={setError}
        />
      )}
    </div>
  );
}

/**
 * Approving and rejecting used window.prompt(), which can't offer a date
 * picker, can't validate before it closes, and can't be styled. Both are now
 * proper dialogs — and the due date is what the borrower sees on the tracking
 * page, so it is worth collecting properly.
 */
function DecisionDialog({
  decision,
  onClose,
  onDone,
  onError,
}: {
  decision: Decision;
  onClose: () => void;
  onDone: (message: string) => void;
  onError: (message: string) => void;
}) {
  const { request, kind } = decision;
  const [dueDate, setDueDate] = useState(defaultDueDate());
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (kind === 'reject' && !reason.trim()) {
      return setError('กรุณากรอกเหตุผล ผู้ยืมจะเห็นข้อความนี้ในหน้าติดตามคำขอ');
    }
    setBusy(true);
    try {
      if (kind === 'approve') {
        await apiJson(`/api/requests/${request.request_id}/approve`, 'PUT', {
          due_date: dueDate || null,
        });
        onDone(`อนุมัติคำขอ ${request.request_id} แล้ว และสร้างรายการยืมเรียบร้อย`);
      } else {
        await apiJson(`/api/requests/${request.request_id}/reject`, 'PUT', { reason: reason.trim() });
        onDone(`ปฏิเสธคำขอ ${request.request_id} แล้ว`);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'บันทึกไม่สำเร็จ';
      setError(message);
      onError(message);
      setBusy(false);
    }
  }

  return (
    <Dialog
      title={kind === 'approve' ? 'อนุมัติคำขอยืม' : 'ปฏิเสธคำขอยืม'}
      subtitle={`${request.borrower_name} · ${request.equipment_name} (${request.request_id})`}
      onClose={onClose}
    >
      <Alert kind="error">{error}</Alert>
      <form onSubmit={submit}>
        {kind === 'approve' ? (
          <div className="field">
            <label htmlFor="dec_due">กำหนดคืน</label>
            <input
              id="dec_due"
              type="date"
              value={dueDate}
              min={new Date().toISOString().slice(0, 10)}
              onChange={(e) => setDueDate(e.target.value)}
              autoFocus
            />
            <div className="hint">ผู้ยืมจะเห็นวันนี้ในหน้าติดตามคำขอ · เว้นว่างได้ถ้ายังไม่กำหนด</div>
          </div>
        ) : (
          <div className="field">
            <label htmlFor="dec_reason">เหตุผลที่ปฏิเสธ *</label>
            <textarea
              id="dec_reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="เช่น เอกสารไม่ครบ กรุณาส่งคำขอใหม่พร้อมรูปบัตรประชาชน"
              autoFocus
            />
            <div className="hint">ผู้ยืมจะเห็นข้อความนี้ในหน้าติดตามคำขอ</div>
          </div>
        )}
        <DialogActions
          confirmLabel={kind === 'approve' ? 'ยืนยันอนุมัติ' : 'ยืนยันปฏิเสธ'}
          onCancel={onClose}
          busy={busy}
          danger={kind === 'reject'}
        />
      </form>
    </Dialog>
  );
}

/** Two weeks out — the common case, still editable. */
function defaultDueDate(): string {
  const d = new Date();
  d.setDate(d.getDate() + 14);
  return d.toISOString().slice(0, 10);
}
