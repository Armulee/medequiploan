'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import Alert from '@/components/Alert';
import { ChevronLeft } from 'lucide-react';
import Turnstile, { turnstileOn } from '@/components/Turnstile';
import { apiJson } from '@/app/lib/api';
import { isValidThaiNationalId, statusBadgeClass, thDate, thDateTime } from '@/app/lib/format';
import { takeNationalId } from '@/app/lib/handoff';

type TrackedRequest = {
  request_id: string;
  requested_at: string;
  status: string;
  note: string;
  due_date: string | null;
  equipment_name: string;
};

type TrackedLoan = {
  record_id: string;
  borrow_date: string;
  due_date: string | null;
  return_date: string | null;
  status: string;
  equipment_name: string;
};

type Result = { requests: TrackedRequest[]; loans: TrackedLoan[] };

const STATUS_HELP: Record<string, string> = {
  รอดำเนินการ: 'เจ้าหน้าที่กำลังตรวจสอบคำขอ จะติดต่อกลับตามเบอร์ที่ให้ไว้',
  อนุมัติ: 'อนุมัติแล้ว เจ้าหน้าที่จะติดต่อนัดวันรับอุปกรณ์',
  ปฏิเสธ: 'คำขอนี้ไม่ได้รับอนุมัติ',
};

export default function TrackingPage() {
  const [nationalId, setNationalId] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const autoRan = useRef(false);
  const [human, setHuman] = useState('');
  const [challengeRound, setChallengeRound] = useState(0);
  // An ID handed over from the request form, held until the challenge is
  // solved. Searching before then would spend an empty token and be refused.
  const [pending, setPending] = useState('');

  const lookup = useCallback(
    async (id: string, token: string) => {
      setError('');
      setResult(null);
      if (!isValidThaiNationalId(id)) {
        setError('เลขบัตรประชาชนไม่ถูกต้อง กรุณาตรวจสอบอีกครั้ง (13 หลัก)');
        return;
      }
      setBusy(true);
      try {
        setResult(
          await apiJson<Result>('/api/tracking', 'POST', {
            national_id: id,
            ...(token ? { turnstile_token: token } : {}),
          })
        );
      } catch (err) {
        setError(err instanceof Error ? err.message : 'ค้นหาไม่สำเร็จ กรุณาลองใหม่');
      } finally {
        // Spent either way — the next search needs a new one.
        setChallengeRound((n) => n + 1);
        setBusy(false);
      }
    },
    []
  );

  // Arriving straight from a submitted request: fill in and search once, then
  // the handed-over value is gone.
  useEffect(() => {
    if (autoRan.current) return;
    autoRan.current = true;
    const handed = takeNationalId();
    if (handed) {
      setNationalId(handed);
      setPending(handed);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The handed-over search runs as soon as it can: immediately when there is
  // no challenge to solve, or the moment the widget produces a token.
  useEffect(() => {
    if (!pending) return;
    if (turnstileOn && !human) return;
    setPending('');
    void lookup(pending, human);
  }, [pending, human, lookup]);

  const empty = result && result.requests.length === 0 && result.loans.length === 0;

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

        <div className="card">
          <h1>ติดตามคำขอยืม</h1>
          <p style={{ color: 'var(--text-muted)', marginTop: -6 }}>
            กรอกเลขบัตรประชาชนที่ใช้ส่งคำขอ เพื่อดูสถานะล่าสุด
          </p>

          <Alert kind="error">{error}</Alert>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              void lookup(nationalId, human);
            }}
          >
            <div className="field">
              <label htmlFor="track_nid">เลขบัตรประชาชน (13 หลัก)</label>
              <input
                id="track_nid"
                type="text"
                inputMode="numeric"
                maxLength={13}
                placeholder="เช่น 1103700230238"
                value={nationalId}
                onChange={(e) => setNationalId(e.target.value.replace(/\D/g, '').slice(0, 13))}
                required
              />
            </div>
            <Turnstile onToken={setHuman} resetSignal={challengeRound} />

            <button
              type="submit"
              className="btn btn-primary btn-block"
              disabled={busy || (turnstileOn && !human)}
            >
              {busy
                ? 'กำลังค้นหา...'
                : turnstileOn && !human
                  ? 'กำลังตรวจสอบว่าไม่ใช่บอท...'
                  : 'ค้นหาคำขอของฉัน'}
            </button>
          </form>
        </div>

        {empty && (
          <div className="card">
            <div className="empty-state">
              ไม่พบคำขอที่ใช้เลขบัตรนี้
              <br />
              <span style={{ fontSize: '0.9rem' }}>
                ตรวจสอบเลขบัตรอีกครั้ง หรือ <Link href="/request">ส่งคำขอยืมอุปกรณ์</Link>
              </span>
            </div>
          </div>
        )}

        {result && result.requests.length > 0 && (
          <div className="card">
            <h2>คำขอยืม</h2>
            <div className="list">
              {result.requests.map((r) => (
                <div className="list-row" key={r.request_id}>
                  <div>
                    <div className="title">{r.equipment_name}</div>
                    <div className="sub">
                      {r.request_id} · ส่งเมื่อ {thDateTime(r.requested_at)}
                    </div>
                    <div className="sub">{STATUS_HELP[r.status] ?? ''}</div>
                    {r.due_date && (
                      <div className="sub track-highlight">
                        กำหนดคืนวันที่ <strong>{thDate(r.due_date)}</strong>
                      </div>
                    )}
                    {r.note && <div className="sub track-highlight">เหตุผล: {r.note}</div>}
                  </div>
                  <span className={statusBadgeClass(r.status)}>{r.status}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {result && result.loans.length > 0 && (
          <div className="card">
            <h2>อุปกรณ์ที่ยืม</h2>
            <div className="list">
              {result.loans.map((r) => (
                <div className="list-row" key={r.record_id}>
                  <div>
                    <div className="title">{r.equipment_name}</div>
                    <div className="sub">
                      รับไปเมื่อ {thDate(r.borrow_date)}
                      {r.due_date ? ` · กำหนดคืน ${thDate(r.due_date)}` : ''}
                      {r.return_date ? ` · คืนแล้วเมื่อ ${thDate(r.return_date)}` : ''}
                    </div>
                  </div>
                  <span className={statusBadgeClass(r.status)}>{r.status}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
