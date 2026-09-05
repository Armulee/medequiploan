'use client';

import { ImageOff, TriangleAlert } from 'lucide-react';
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

      {/* The card photographed for THIS request, above the values it is meant
          to verify. Without it the instruction to "check against the ID card"
          is unfollowable — and for a borrower who already existed, the request
          is the ONLY place the new photograph lives, because the public form
          is not allowed to write over what is on file. */}
      <RequestPhotos request={request} />

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

/**
 * The attachments that came with this submission.
 *
 * Explicit about all three states, because "no photograph shown" used to mean
 * any of them and a member of staff could not tell which: none was attached,
 * one was attached but the file is gone, or one is there and loading. The
 * middle case is the one that matters — a request whose ID card has been lost
 * cannot be verified, and approving it anyway is the failure this whole screen
 * exists to prevent.
 */
function RequestPhotos({
  request,
}: {
  request: RequestDetailResponse['request'];
}) {
  const [broken, setBroken] = useState<Record<string, boolean>>({});

  const photos = [
    { key: 'id', url: request.id_card_photo_url, label: 'รูปบัตรประชาชนที่แนบมากับคำขอนี้' },
    { key: 'illness', url: request.illness_photo_url, label: 'รูปอาการป่วย' },
  ].filter((p) => p.url);

  if (photos.length === 0) {
    return (
      <div className="hint hint-error" style={{ marginBottom: 12 }}>
        <TriangleAlert size={14} /> คำขอนี้ไม่มีรูปบัตรแนบมา — ตรวจสอบตัวตนกับรูปบัตรในประวัติผู้ยืมด้านล่างแทน
      </div>
    );
  }

  return (
    <div className="photo-grid" style={{ marginBottom: 14 }}>
      {photos.map((p) => (
        <figure key={p.key}>
          {broken[p.key] ? (
            <div className="photo-missing">
              <ImageOff size={20} />
              <span>เปิดรูปไม่ได้ — ไฟล์อาจถูกลบไปแล้ว</span>
            </div>
          ) : (
            // A link as well as an image: the small print on a card is not
            // readable in a 220px column, and /api/files checks the session
            // on the full-size view exactly as it does on the thumbnail.
            <a href={p.url} target="_blank" rel="noreferrer">
              <img
                src={p.url}
                alt={p.label}
                onError={() => setBroken((b) => ({ ...b, [p.key]: true }))}
              />
            </a>
          )}
          <figcaption>{p.label}</figcaption>
        </figure>
      ))}
    </div>
  );
}
