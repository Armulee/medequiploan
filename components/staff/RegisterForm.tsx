'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import ConsentNotice from '@/components/ConsentNotice';
import PhotoInput from '@/components/PhotoInput';
import { apiForm } from '@/app/lib/api';
import { isValidThaiNationalId } from '@/app/lib/format';
import { normalisePhone } from '@/lib/validate';
import type { BorrowerFull } from '@/app/lib/types';

const EMPTY = {
  first_name: '',
  last_name: '',
  national_id: '',
  address: '',
  phone: '',
  line_id: '',
  email: '',
  illness_description: '',
};

type FieldError = 'national_id' | 'phone' | 'id_card' | 'consent';

/**
 * Registering someone is the first half of lending to them, so this is a form
 * rather than a page: it hands the new borrower to whoever asked for it, and
 * the lend page sends them straight on to that person's own page.
 */
export default function RegisterForm({
  onRegistered,
}: {
  onRegistered: (borrower: BorrowerFull) => void;
}) {
  const [form, setForm] = useState(EMPTY);
  // Validation stays next to the field it is about; only the outcome of the
  // save is raised as a toast.
  const [invalid, setInvalid] = useState<FieldError | null>(null);
  const [busy, setBusy] = useState(false);
  const [consent, setConsent] = useState(false);
  const [idCard, setIdCard] = useState<File | null>(null);
  const [photo, setPhoto] = useState<File | null>(null);

  const set =
    (k: keyof typeof EMPTY) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((f) => ({ ...f, [k]: e.target.value }));

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setInvalid(null);

    if (!isValidThaiNationalId(form.national_id)) return setInvalid('national_id');
    if (!normalisePhone(form.phone)) return setInvalid('phone');
    if (!idCard) return setInvalid('id_card');
    if (!consent) return setInvalid('consent');
    setBusy(true);
    try {
      const fd = new FormData();
      Object.entries(form).forEach(([k, v]) => fd.append(k, v.trim()));
      fd.append('consent', 'true');
      fd.append('id_card_photo', idCard);
      if (photo) fd.append('illness_photo', photo);
      const res = await apiForm<{ borrower: BorrowerFull }>('/api/borrowers', fd);
      toast.success(
        `ลงทะเบียน ${res.borrower.first_name} ${res.borrower.last_name} แล้ว (รหัส ${res.borrower.borrower_id})`
      );
      setForm(EMPTY);
      setIdCard(null);
      setPhoto(null);
      setConsent(false);
      onRegistered(res.borrower);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'ลงทะเบียนไม่สำเร็จ');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <p className="hint" style={{ marginBottom: 12 }}>
        เลขบัตรประชาชนจะถูกเข้ารหัสก่อนบันทึก และแสดงแบบปิดบังในหน้ารายการ
      </p>

      <form onSubmit={onSubmit}>
        <div className="row">
          <div className="field">
            <label htmlFor="reg_first">ชื่อ *</label>
            <input id="reg_first" type="text" value={form.first_name} onChange={set('first_name')} required />
          </div>
          <div className="field">
            <label htmlFor="reg_last">นามสกุล *</label>
            <input id="reg_last" type="text" value={form.last_name} onChange={set('last_name')} required />
          </div>
        </div>

        <div className="field">
          <label htmlFor="reg_nid">เลขบัตรประชาชน (13 หลัก) *</label>
          <input
            id="reg_nid"
            type="text"
            inputMode="numeric"
            maxLength={13}
            value={form.national_id}
            onChange={(e) =>
              setForm((f) => ({ ...f, national_id: e.target.value.replace(/\D/g, '').slice(0, 13) }))
            }
            required
          />
          {invalid === 'national_id' && (
            <div className="hint hint-error">เลขบัตรประชาชนไม่ถูกต้อง กรุณาตรวจสอบ (13 หลัก)</div>
          )}
        </div>

        <div className="field">
          <label htmlFor="reg_address">ที่อยู่ *</label>
          <textarea id="reg_address" value={form.address} onChange={set('address')} required />
        </div>

        <div className="row">
          <div className="field">
            <label htmlFor="reg_phone">เบอร์โทรศัพท์ *</label>
            <input
              id="reg_phone"
              type="tel"
              inputMode="tel"
              placeholder="เช่น 0812345678"
              value={form.phone}
              onChange={set('phone')}
              required
            />
            {invalid === 'phone' && (
              <div className="hint hint-error">
                เบอร์โทรศัพท์ไม่ถูกต้อง กรุณากรอกเบอร์ที่ติดต่อได้ (เช่น 0812345678)
              </div>
            )}
          </div>
          <div className="field">
            <label htmlFor="reg_line">LINE ID</label>
            <input id="reg_line" type="text" placeholder="ถ้ามี" value={form.line_id} onChange={set('line_id')} />
          </div>
        </div>

        <div className="field">
          <label htmlFor="reg_email">อีเมล</label>
          <input id="reg_email" type="email" placeholder="ถ้ามี" value={form.email} onChange={set('email')} />
        </div>

        <div className="field">
          <label htmlFor="reg_illness">อาการ / เหตุผลที่ต้องใช้อุปกรณ์</label>
          <textarea id="reg_illness" value={form.illness_description} onChange={set('illness_description')} />
        </div>

        <PhotoInput
          id="reg_id_card_photo"
          label="รูปบัตรประชาชน"
          required
          file={idCard}
          onPick={setIdCard}
          hint="ถ่ายบัตรของผู้ยืม หรือเลือกรูปที่มีอยู่แล้ว · เก็บไว้ให้ตรวจสอบย้อนหลังได้"
        />
        {invalid === 'id_card' && (
          <div className="field">
            <div className="hint hint-error">กรุณาแนบรูปบัตรประชาชนของผู้ยืม</div>
          </div>
        )}

        <PhotoInput
          id="reg_illness_photo"
          label="ภาพประกอบอาการป่วย (ถ้ามี)"
          file={photo}
          onPick={setPhoto}
          hint="ไม่บังคับ · เป็นข้อมูลสุขภาพ เห็นได้เฉพาะเจ้าหน้าที่ที่เข้าสู่ระบบ"
        />

        <ConsentNotice
          checked={consent}
          onChange={setConsent}
          label="ข้าพเจ้าได้แจ้งประกาศความเป็นส่วนตัวให้ผู้ยืมทราบ และผู้ยืมให้ความยินยอมแล้ว"
        />
        {invalid === 'consent' && (
          <div className="field">
            <div className="hint hint-error">
              กรุณายืนยันว่าได้แจ้งประกาศความเป็นส่วนตัวและผู้ยืมให้ความยินยอมแล้ว
            </div>
          </div>
        )}

        <button type="submit" className="btn btn-primary btn-block" disabled={busy}>
          {busy ? 'กำลังบันทึก...' : 'ลงทะเบียน แล้วไปหน้าจ่ายอุปกรณ์'}
        </button>
      </form>
    </>
  );
}
