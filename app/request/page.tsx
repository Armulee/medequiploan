'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import Alert from '@/components/Alert';
import ConsentNotice from '@/components/ConsentNotice';
import Turnstile, { turnstileOn } from '@/components/Turnstile';
import { Check, ChevronLeft } from 'lucide-react';
import { api, apiForm } from '@/app/lib/api';
import { isValidThaiNationalId } from '@/app/lib/format';
import { normaliseEmail, normalisePhone } from '@/lib/validate';
import { stashNationalId } from '@/app/lib/handoff';
import { useRouter } from 'next/navigation';
import PhotoInput from '@/components/PhotoInput';
import type { Equipment } from '@/app/lib/types';

export default function RequestPage() {
  const router = useRouter();
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [requestId, setRequestId] = useState<string | null>(null);

  const [form, setForm] = useState({
    first_name: '',
    last_name: '',
    national_id: '',
    address: '',
    phone: '',
    line_id: '',
    email: '',
    equipment_id: '',
    illness_description: '',
  });
  const [consent, setConsent] = useState(false);
  const [idCard, setIdCard] = useState<File | null>(null);
  const [photo, setPhoto] = useState<File | null>(null);
  // Empty until the challenge is solved, and back to empty when it expires.
  // Only meaningful when Turnstile is configured at all.
  const [human, setHuman] = useState('');
  const [challengeRound, setChallengeRound] = useState(0);

  useEffect(() => {
    api<{ equipment: Equipment[] }>('/api/equipment')
      .then((d) => setEquipment(d.equipment))
      .catch(() => setError('ไม่สามารถโหลดรายการอุปกรณ์ได้ กรุณารีเฟรชหน้าอีกครั้ง'));
  }, []);


  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    // Check the checksum before sending so an obvious typo is caught without a
    // round trip; the server validates again regardless.
    if (!isValidThaiNationalId(form.national_id)) {
      setError('เลขบัตรประชาชนไม่ถูกต้อง กรุณาตรวจสอบอีกครั้ง (13 หลัก)');
      return;
    }
    if (!normalisePhone(form.phone)) {
      setError('เบอร์โทรศัพท์ไม่ถูกต้อง กรุณากรอกเบอร์ที่ติดต่อได้ (เช่น 0812345678)');
      return;
    }
    if (normaliseEmail(form.email) === null) {
      setError('อีเมลไม่ถูกต้อง กรุณาตรวจสอบอีกครั้ง');
      return;
    }
    if (!idCard) {
      setError('กรุณาแนบรูปบัตรประชาชน เจ้าหน้าที่ต้องใช้ตรวจสอบก่อนอนุมัติ');
      return;
    }
    if (!consent) {
      setError('กรุณาอ่านและยอมรับประกาศความเป็นส่วนตัว (PDPA) ก่อนส่งคำขอ');
      return;
    }

    setSubmitting(true);
    try {
      const fd = new FormData();
      Object.entries(form).forEach(([k, v]) => fd.append(k, v.trim()));
      fd.append('consent', 'true');
      if (human) fd.append('turnstile_token', human);
      fd.append('id_card_photo', idCard);
      if (photo) fd.append('illness_photo', photo);

      const res = await apiForm<{ request: { request_id: string } }>('/api/requests', fd);
      stashNationalId(form.national_id);
      setRequestId(res.request.request_id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'ไม่สามารถเชื่อมต่อระบบได้ กรุณาลองใหม่');
      // The token is spent whether or not the rest of the request was valid,
      // so the next attempt needs a fresh challenge.
      setChallengeRound((n) => n + 1);
      setSubmitting(false);
    }
  }

  return (
    <>
      <header className="app-header">
        <Link href="/" className="brand" style={{ color: 'white' }}>
          <span className="dot" />
          ศูนย์ยืม-คืนกายอุปกรณ์
        </Link>
      </header>

      <div className="container" style={{ paddingTop: 20 }}>
        <Link href="/" className="back-link">
          <ChevronLeft size={20} strokeWidth={2.5} />
          กลับหน้าแรก
        </Link>

        {requestId ? (
          <div className="card" style={{ textAlign: 'center' }}>
            <div
              style={{
                width: 56,
                height: 56,
                borderRadius: '50%',
                background: 'var(--green-bg)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 14px',
              }}
            >
              <Check size={28} color="var(--green)" strokeWidth={2.5} />
            </div>
            <h2>ส่งคำขอเรียบร้อยแล้ว</h2>
            <p style={{ color: 'var(--text-muted)' }}>
              หมายเลขคำขอของคุณคือ <strong>{requestId}</strong>
              <br />
              เจ้าหน้าที่จะตรวจสอบและติดต่อกลับเพื่อนัดรับอุปกรณ์
            </p>
            <button className="btn btn-primary btn-lg" onClick={() => router.push('/tracking')}>
              ติดตามสถานะคำขอ
            </button>
          </div>
        ) : (
          <div className="card">
            <h1>ส่งคำขอยืมอุปกรณ์</h1>
            <p style={{ color: 'var(--text-muted)', marginTop: -6 }}>
              กรอกข้อมูลให้ครบถ้วน เจ้าหน้าที่จะตรวจสอบและติดต่อกลับ ไม่ต้องเข้าสู่ระบบ
            </p>

            <Alert kind="error">{error}</Alert>

            <form onSubmit={onSubmit}>
              <div className="row">
                <div className="field">
                  <label htmlFor="first_name">ชื่อ *</label>
                  <input id="first_name" value={form.first_name} onChange={set('first_name')} required />
                </div>
                <div className="field">
                  <label htmlFor="last_name">นามสกุล *</label>
                  <input id="last_name" value={form.last_name} onChange={set('last_name')} required />
                </div>
              </div>

              <div className="field">
                <label htmlFor="national_id">เลขบัตรประชาชน (13 หลัก) *</label>
                <input
                  id="national_id"
                  inputMode="numeric"
                  maxLength={13}
                  placeholder="เช่น 1103700230238"
                  value={form.national_id}
                  // Strip anything that isn't a digit as it's typed, so the
                  // field can only ever hold a well-formed ID.
                  onChange={(e) =>
                    setForm((f) => ({ ...f, national_id: e.target.value.replace(/\D/g, '').slice(0, 13) }))
                  }
                  required
                />
                <div className="hint">
                  ใช้สำหรับตรวจสอบสิทธิ์และยืนยันตัวตน ระบบจะเข้ารหัสข้อมูลนี้ก่อนบันทึก
                </div>
              </div>

              <div className="field">
                <label htmlFor="address">ที่อยู่ *</label>
                <textarea id="address" value={form.address} onChange={set('address')} required />
              </div>

              <div className="row">
                <div className="field">
                  <label htmlFor="phone">เบอร์โทรศัพท์ *</label>
                  <input
                    id="phone"
                    type="tel"
                    inputMode="tel"
                    placeholder="เช่น 0812345678"
                    value={form.phone}
                    onChange={set('phone')}
                    required
                  />
                </div>
                <div className="field">
                  <label htmlFor="line_id">LINE ID</label>
                  <input
                    id="line_id"
                    type="text"
                    placeholder="ถ้ามี (ไม่บังคับ)"
                    value={form.line_id}
                    onChange={set('line_id')}
                  />
                </div>
              </div>

              <div className="field">
                <label htmlFor="email">อีเมล</label>
                <input
                  id="email"
                  type="email"
                  inputMode="email"
                  placeholder="ถ้ามี (ไม่บังคับ)"
                  value={form.email}
                  onChange={set('email')}
                />
              </div>

              <div className="field">
                <label htmlFor="equipment_id">อุปกรณ์ที่ต้องการยืม *</label>
                <select id="equipment_id" value={form.equipment_id} onChange={set('equipment_id')} required>
                  <option value="">-- เลือกอุปกรณ์ --</option>
                  {equipment.map((e) => (
                    <option key={e.equipment_id} value={e.equipment_id} disabled={e.available_qty <= 0}>
                      {e.name} (เหลือ {e.available_qty} ชิ้น)
                      {e.available_qty <= 0 ? ' — ไม่พร้อมให้ยืม' : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div className="field">
                <label htmlFor="illness_description">อธิบายอาการเพิ่มเติม</label>
                <textarea
                  id="illness_description"
                  placeholder="เช่น ขาอ่อนแรง เดินลำบาก ต้องใช้พยุงเดิน"
                  value={form.illness_description}
                  onChange={set('illness_description')}
                />
              </div>

              <PhotoInput
                id="id_card_photo"
                label="รูปบัตรประชาชน"
                required
                file={idCard}
                onPick={setIdCard}
                hint="ถ่ายรูปบัตร หรือเลือกรูปที่มีอยู่แล้วก็ได้ · เจ้าหน้าที่ใช้ตรวจสอบตัวตนก่อนอนุมัติ และเห็นได้เฉพาะเจ้าหน้าที่ที่เข้าสู่ระบบ"
              />

              <PhotoInput
                id="illness_photo"
                label="ภาพประกอบอาการป่วย (ถ้ามี)"
                file={photo}
                onPick={setPhoto}
                hint="ไม่บังคับ · ช่วยให้เจ้าหน้าที่เลือกอุปกรณ์ให้เหมาะกับอาการ"
              />

              <ConsentNotice checked={consent} onChange={setConsent} />

              <Turnstile onToken={setHuman} resetSignal={challengeRound} />

              <button
                type="submit"
                className="btn btn-primary btn-block"
                disabled={submitting || (turnstileOn && !human)}
              >
                {submitting
                  ? 'กำลังส่งคำขอ...'
                  : turnstileOn && !human
                    ? 'กำลังตรวจสอบว่าไม่ใช่บอท...'
                    : 'ส่งคำขอยืม'}
              </button>
            </form>
          </div>
        )}

      </div>
    </>
  );
}
