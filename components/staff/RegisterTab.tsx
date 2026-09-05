'use client';

import { useRef, useState } from 'react';
import Alert from '@/components/Alert';
import ConsentNotice from '@/components/ConsentNotice';
import { apiForm } from '@/app/lib/api';
import { isValidThaiNationalId } from '@/app/lib/format';
import { normalisePhone } from '@/lib/validate';
import { formatBytes, resizeImage } from '@/app/lib/resize-image';
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

export default function RegisterTab() {
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState('');
  const [done, setDone] = useState<BorrowerFull | null>(null);
  const [busy, setBusy] = useState(false);
  const [consent, setConsent] = useState(false);
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoNote, setPhotoNote] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const set =
    (k: keyof typeof EMPTY) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((f) => ({ ...f, [k]: e.target.value }));

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setDone(null);

    if (!isValidThaiNationalId(form.national_id)) {
      setError('เลขบัตรประชาชนไม่ถูกต้อง กรุณาตรวจสอบ (13 หลัก)');
      return;
    }
    if (!normalisePhone(form.phone)) {
      setError('เบอร์โทรศัพท์ไม่ถูกต้อง กรุณากรอกเบอร์ที่ติดต่อได้ (เช่น 0812345678)');
      return;
    }
    if (!consent) {
      setError('กรุณายืนยันว่าได้แจ้งประกาศความเป็นส่วนตัวและผู้ยืมให้ความยินยอมแล้ว');
      return;
    }
    setBusy(true);
    try {
      const fd = new FormData();
      Object.entries(form).forEach(([k, v]) => fd.append(k, v.trim()));
      fd.append('consent', 'true');
      if (photo) fd.append('illness_photo', photo);
      const res = await apiForm<{ borrower: BorrowerFull }>('/api/borrowers', fd);
      setDone(res.borrower);
      setForm(EMPTY);
      setPhoto(null);
      setPhotoNote('');
      setConsent(false);
      if (fileRef.current) fileRef.current.value = '';
    } catch (err) {
      setError(err instanceof Error ? err.message : 'ลงทะเบียนไม่สำเร็จ');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card">
      <h1>ลงทะเบียนผู้ยืม</h1>
      <p style={{ color: 'var(--text-muted)', marginTop: -6 }}>
        เลขบัตรประชาชนจะถูกเข้ารหัสก่อนบันทึก และแสดงแบบปิดบังในหน้ารายการ
      </p>

      <Alert kind="error">{error}</Alert>
      {done && (
        <Alert kind="success">
          ลงทะเบียนสำเร็จ: {done.first_name} {done.last_name} (รหัส {done.borrower_id})
        </Alert>
      )}

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

        <div className="field">
          <label htmlFor="reg_illness_photo">ภาพประกอบอาการป่วย (ถ้ามี)</label>
          <input
            id="reg_illness_photo"
            type="file"
            accept="image/*"
            capture="environment"
            ref={fileRef}
            onChange={async (e) => {
              const picked = e.target.files?.[0];
              if (!picked) {
                setPhoto(null);
                setPhotoNote('');
                return;
              }
              setPhotoNote('กำลังย่อรูป...');
              const resized = await resizeImage(picked);
              setPhoto(resized);
              setPhotoNote(
                resized.size < picked.size
                  ? `ย่อรูปแล้ว ${formatBytes(picked.size)} → ${formatBytes(resized.size)}`
                  : `ขนาดไฟล์ ${formatBytes(resized.size)}`
              );
            }}
          />
          <div className="hint">
            {photoNote || 'ไม่บังคับ · เป็นข้อมูลสุขภาพ เห็นได้เฉพาะเจ้าหน้าที่ที่เข้าสู่ระบบ'}
          </div>
        </div>

        <ConsentNotice
          checked={consent}
          onChange={setConsent}
          label="ข้าพเจ้าได้แจ้งประกาศความเป็นส่วนตัวให้ผู้ยืมทราบ และผู้ยืมให้ความยินยอมแล้ว"
        />

        <button type="submit" className="btn btn-primary btn-block" disabled={busy}>
          {busy ? 'กำลังบันทึก...' : 'บันทึกการลงทะเบียน'}
        </button>
      </form>
    </div>
  );
}
