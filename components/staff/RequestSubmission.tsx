'use client';

import { TriangleAlert } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import Dialog, { DialogActions } from '@/components/Dialog';
import { apiJson } from '@/app/lib/api';
import { thDateTime } from '@/app/lib/format';
import type { RequestContact, RequestDetailResponse } from '@/app/lib/types';

const LABELS: Record<keyof RequestContact, string> = {
  name: 'ชื่อ-นามสกุล',
  phone: 'เบอร์โทรศัพท์',
  line_id: 'LINE ID',
  email: 'อีเมล',
  address: 'ที่อยู่',
};

/**
 * What this request actually said, next to what the record says.
 *
 * The public form used to write its contents straight onto the borrower, so a
 * changed phone number simply appeared as fact. It proves nothing but
 * knowledge of a national ID, so it is shown as a claim now — and where the
 * claim disagrees with the record, that is said plainly, because ringing back
 * a number an impostor supplied is the whole attack.
 */
export default function RequestSubmission({
  detail,
  onAdopted,
}: {
  detail: RequestDetailResponse;
  onAdopted: () => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const { submitted, on_file: onFile, differs, request } = detail;

  const rows = (Object.keys(LABELS) as Array<keyof RequestContact>).filter(
    (k) => submitted[k] || onFile[k]
  );

  async function adopt() {
    setBusy(true);
    try {
      const d = await apiJson<{ changed: string[] }>(
        `/api/requests/${request.request_id}/adopt-contact`,
        'POST'
      );
      toast.success(`อัปเดตข้อมูลผู้ยืมแล้ว: ${d.changed.join(', ')}`);
      setConfirming(false);
      onAdopted();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'อัปเดตไม่สำเร็จ');
      setBusy(false);
    }
  }

  return (
    <div className="card">
      <div className="card-head card-head-row">
        <h2>ข้อมูลที่กรอกมาในคำขอนี้</h2>
        {differs.length > 0 && (
          <span className="badge badge-overdue">
            <TriangleAlert size={12} /> ต่างจากในระบบ {differs.length} จุด
          </span>
        )}
      </div>

      <p style={{ color: 'var(--text-muted)', marginTop: -6 }}>
        {detail.borrower_self_registered && !onFile.phone
          ? 'ผู้ยืมรายนี้มาจากฟอร์มออนไลน์ ข้อมูลด้านล่างคือสิ่งที่กรอกมา'
          : 'ฟอร์มสาธารณะไม่แก้ข้อมูลในระบบเอง — ตรวจกับรูปบัตรก่อน แล้วค่อยกดอัปเดตถ้าถูกต้อง'}
      </p>

      <div className="compare">
        {rows.map((k) => {
          const changed = differs.includes(k);
          return (
            <div key={k} className={changed ? 'compare-row compare-changed' : 'compare-row'}>
              <div className="compare-label">{LABELS[k]}</div>
              <div className="compare-cell">
                <span className="compare-tag">กรอกมา</span>
                {submitted[k] || '—'}
              </div>
              <div className="compare-cell">
                <span className="compare-tag">ในระบบ</span>
                {onFile[k] || '—'}
              </div>
            </div>
          );
        })}
      </div>

      {request.consent_accepted_at && (
        <div className="hint" style={{ marginTop: 10 }}>
          ยินยอม PDPA เวอร์ชัน {request.consent_version} เมื่อ{' '}
          {thDateTime(request.consent_accepted_at)}
        </div>
      )}

      {differs.length > 0 && (
        <div className="detail-actions">
          <button className="btn btn-outline" onClick={() => setConfirming(true)}>
            อัปเดตข้อมูลผู้ยืมตามคำขอนี้
          </button>
        </div>
      )}

      {confirming && (
        <Dialog title="อัปเดตข้อมูลผู้ยืม" onClose={() => (busy ? undefined : setConfirming(false))}>
          <div className="confirm-summary">
            จะเขียนข้อมูลที่กรอกมาในคำขอ <strong>{request.request_id}</strong> ทับข้อมูลเดิมของผู้ยืม
            <br />
            <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
              ทำเมื่อตรวจรูปบัตรแล้วว่าเป็นคนเดียวกันจริง · จะถูกบันทึกไว้ใน audit log
              ว่าใครเป็นคนกดและกดจากคำขอไหน
            </span>
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void adopt();
            }}
          >
            <DialogActions
              confirmLabel="ยืนยันอัปเดต"
              onCancel={() => setConfirming(false)}
              busy={busy}
            />
          </form>
        </Dialog>
      )}
    </div>
  );
}
