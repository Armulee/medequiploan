'use client';

import { useCallback, useEffect, useState } from 'react';
import Alert from '@/components/Alert';
import { api, apiJson } from '@/app/lib/api';
import { statusBadgeClass, thDateTime } from '@/app/lib/format';
import type { BorrowRequest } from '@/app/lib/types';

const FILTERS = ['รอดำเนินการ', 'อนุมัติ', 'ปฏิเสธ', 'ทั้งหมด'] as const;

export default function RequestsTab() {
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>('รอดำเนินการ');
  const [items, setItems] = useState<BorrowRequest[] | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);

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

  async function approve(r: BorrowRequest) {
    const due = window.prompt(
      `อนุมัติคำขอ ${r.request_id}\nกำหนดคืน (YYYY-MM-DD, เว้นว่างได้)`,
      ''
    );
    if (due === null) return;

    setError('');
    setSuccess('');
    setBusyId(r.request_id);
    try {
      await apiJson(`/api/requests/${r.request_id}/approve`, 'PUT', { due_date: due || null });
      setSuccess(`อนุมัติคำขอ ${r.request_id} แล้ว และสร้างรายการยืมเรียบร้อย`);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'อนุมัติไม่สำเร็จ');
    } finally {
      setBusyId(null);
    }
  }

  async function reject(r: BorrowRequest) {
    const reason = window.prompt(`ปฏิเสธคำขอ ${r.request_id}\nเหตุผล`, '');
    if (reason === null) return;

    setError('');
    setSuccess('');
    setBusyId(r.request_id);
    try {
      await apiJson(`/api/requests/${r.request_id}/reject`, 'PUT', { reason });
      setSuccess(`ปฏิเสธคำขอ ${r.request_id} แล้ว`);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'ปฏิเสธไม่สำเร็จ');
    } finally {
      setBusyId(null);
    }
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
                  {r.borrower_name} · {r.equipment_name}
                </div>
                <div className="sub">
                  {r.request_id} · ส่งเมื่อ {thDateTime(r.requested_at)}
                  {r.note ? ` · ${r.note}` : ''}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <span className={statusBadgeClass(r.status)}>{r.status}</span>
                {r.status === 'รอดำเนินการ' && (
                  <>
                    <button
                      className="btn btn-sm btn-primary"
                      disabled={busyId === r.request_id}
                      onClick={() => approve(r)}
                    >
                      อนุมัติ
                    </button>
                    <button
                      className="btn btn-sm btn-outline"
                      disabled={busyId === r.request_id}
                      onClick={() => reject(r)}
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
    </div>
  );
}
