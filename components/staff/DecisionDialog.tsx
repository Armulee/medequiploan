'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import Dialog, { DialogActions } from '@/components/Dialog';
import { apiJson } from '@/app/lib/api';
import type { BorrowRequest } from '@/app/lib/types';

export type Decision = { request: BorrowRequest; kind: 'approve' | 'reject' };

/**
 * Approving and rejecting used window.prompt(), which can't offer a date
 * picker, can't validate before it closes, and can't be styled. Both are now
 * proper dialogs — and the due date is what the borrower sees on the tracking
 * page, so it is worth collecting properly.
 */
export default function DecisionDialog({
  decision,
  onClose,
  onDone,
}: {
  decision: Decision;
  onClose: () => void;
  onDone: () => void;
}) {
  const { request, kind } = decision;
  const [dueDate, setDueDate] = useState(defaultDueDate());
  const [reason, setReason] = useState('');
  // Kept inline rather than raised as a toast: the empty field it refers to is
  // right there, and a toast would cover it.
  const [invalid, setInvalid] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setInvalid('');
    if (kind === 'reject' && !reason.trim()) {
      return setInvalid('กรุณากรอกเหตุผล ผู้ยืมจะเห็นข้อความนี้ในหน้าติดตามคำขอ');
    }
    setBusy(true);
    try {
      if (kind === 'approve') {
        await apiJson(`/api/requests/${request.request_id}/approve`, 'PUT', {
          due_date: dueDate || null,
        });
        toast.success(`อนุมัติคำขอ ${request.request_id} แล้ว และสร้างรายการยืมเรียบร้อย`);
      } else {
        await apiJson(`/api/requests/${request.request_id}/reject`, 'PUT', { reason: reason.trim() });
        toast.success(`ปฏิเสธคำขอ ${request.request_id} แล้ว`);
      }
      onDone();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'บันทึกไม่สำเร็จ');
      setBusy(false);
    }
  }

  return (
    <Dialog
      title={kind === 'approve' ? 'อนุมัติคำขอยืม' : 'ปฏิเสธคำขอยืม'}
      subtitle={`${request.borrower_name} · ${request.equipment_name} (${request.request_id})`}
      onClose={onClose}
    >
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
              placeholder="เช่น อุปกรณ์หมดชั่วคราว กรุณาส่งคำขอใหม่ในสัปดาห์หน้า"
              autoFocus
            />
            <div className={invalid ? 'hint hint-error' : 'hint'}>
              {invalid || 'ผู้ยืมจะเห็นข้อความนี้ในหน้าติดตามคำขอ'}
            </div>
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
