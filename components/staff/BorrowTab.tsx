'use client';

import { useCallback, useEffect, useState } from 'react';
import Alert from '@/components/Alert';
import { api, apiJson } from '@/app/lib/api';
import { statusBadgeClass, thDate } from '@/app/lib/format';
import BorrowerSearch from './BorrowerSearch';
import type { BorrowerListItem, Equipment, LoanRecord } from '@/app/lib/types';

export default function BorrowTab({
  initialFilter,
}: {
  initialFilter?: 'active' | 'overdue';
}) {
  const [picked, setPicked] = useState<BorrowerListItem | null>(null);
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [equipmentId, setEquipmentId] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [active, setActive] = useState<LoanRecord[] | null>(null);
  const [onlyOverdue, setOnlyOverdue] = useState(initialFilter === 'overdue');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [busy, setBusy] = useState(false);

  const loadEquipment = useCallback(() => {
    api<{ equipment: Equipment[] }>('/api/equipment')
      .then((d) => setEquipment(d.equipment))
      .catch(() => setError('โหลดรายการอุปกรณ์ไม่สำเร็จ'));
  }, []);

  const loadActive = useCallback(() => {
    api<{ records: LoanRecord[] }>('/api/records')
      .then((d) => setActive(d.records.filter((r) => r.status !== 'คืนแล้ว')))
      .catch((e) => setError(e instanceof Error ? e.message : 'โหลดรายการยืมไม่สำเร็จ'));
  }, []);

  useEffect(() => {
    loadEquipment();
    loadActive();
  }, [loadEquipment, loadActive]);

  async function onBorrow(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSuccess('');
    if (!picked) return setError('กรุณาเลือกผู้ยืม');
    if (!equipmentId) return setError('กรุณาเลือกอุปกรณ์');

    setBusy(true);
    try {
      await apiJson('/api/records', 'POST', {
        borrower_id: picked.borrower_id,
        equipment_id: equipmentId,
        due_date: dueDate || null,
      });
      setSuccess('บันทึกการยืมสำเร็จ');
      setPicked(null);
      setEquipmentId('');
      setDueDate('');
      // Stock and the active list both changed, so refresh from the server
      // rather than adjusting local copies that could drift.
      loadEquipment();
      loadActive();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'บันทึกการยืมไม่สำเร็จ');
    } finally {
      setBusy(false);
    }
  }

  async function onReturn(record: LoanRecord) {
    const condition = window.prompt(
      `คืนอุปกรณ์: ${record.equipment_name}\nสภาพอุปกรณ์ตอนรับคืน (เว้นว่างได้)`,
      'สภาพปกติ'
    );
    if (condition === null) return;

    setError('');
    setSuccess('');
    try {
      await apiJson(`/api/records/${record.record_id}/return`, 'PUT', {
        condition_on_return: condition,
      });
      setSuccess(`รับคืน ${record.equipment_name} เรียบร้อย`);
      loadEquipment();
      loadActive();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'บันทึกการคืนไม่สำเร็จ');
    }
  }

  const shown = (active ?? []).filter((r) => !onlyOverdue || r.status === 'เกินกำหนด');

  return (
    <>
      <div className="card">
        <h1>บันทึกการยืม</h1>
        <Alert kind="error">{error}</Alert>
        <Alert kind="success">{success}</Alert>

        {picked ? (
          <div className="picked-box">
            <div>
              <div className="title">
                {picked.first_name} {picked.last_name}
              </div>
              <div className="sub">
                {picked.borrower_id} · {picked.national_id_masked}
                {picked.phone ? ` · โทร ${picked.phone}` : ''}
              </div>
            </div>
            <button className="btn btn-sm btn-outline" onClick={() => setPicked(null)}>
              เปลี่ยน
            </button>
          </div>
        ) : (
          <BorrowerSearch onPick={setPicked} />
        )}

        <form onSubmit={onBorrow} style={{ marginTop: 14 }}>
          <div className="field">
            <label htmlFor="bw_equipment">อุปกรณ์ *</label>
            <select
              id="bw_equipment"
              value={equipmentId}
              onChange={(e) => setEquipmentId(e.target.value)}
              required
            >
              <option value="">-- เลือกอุปกรณ์ --</option>
              {equipment.map((e) => (
                <option key={e.equipment_id} value={e.equipment_id} disabled={e.available_qty <= 0}>
                  {e.name} (เหลือ {e.available_qty})
                  {e.available_qty <= 0 ? ' — หมด' : ''}
                </option>
              ))}
            </select>
          </div>

          <div className="field">
            <label htmlFor="bw_due">กำหนดคืน</label>
            <input id="bw_due" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </div>

          <button type="submit" className="btn btn-primary btn-block" disabled={busy || !picked}>
            {busy ? 'กำลังบันทึก...' : 'บันทึกการยืม'}
          </button>
        </form>
      </div>

      <div className="card">
        <div className="card-head">
          <h2>รายการที่ยืมอยู่</h2>
          <div className="filter-row" style={{ margin: 0 }}>
            <button
              className={`btn btn-sm ${onlyOverdue ? 'btn-outline' : 'btn-primary'}`}
              onClick={() => setOnlyOverdue(false)}
            >
              ทั้งหมด
            </button>
            <button
              className={`btn btn-sm ${onlyOverdue ? 'btn-primary' : 'btn-outline'}`}
              onClick={() => setOnlyOverdue(true)}
            >
              เกินกำหนด
            </button>
          </div>
        </div>
        {active === null ? (
          <div className="empty-state">กำลังโหลด...</div>
        ) : shown.length === 0 ? (
          <div className="empty-state">
            {onlyOverdue ? 'ไม่มีรายการเกินกำหนด' : 'ไม่มีรายการยืมอยู่ในขณะนี้'}
          </div>
        ) : (
          <div className="list">
            {shown.map((r) => (
              <div className="list-row" key={r.record_id}>
                <div>
                  <div className="title">{r.equipment_name}</div>
                  <div className="sub">
                    {r.borrower_name} · ยืม {thDate(r.borrow_date)}
                    {r.due_date ? ` · ครบกำหนด ${thDate(r.due_date)}` : ''}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <span className={statusBadgeClass(r.status)}>{r.status}</span>
                  <button className="btn btn-sm btn-primary" onClick={() => onReturn(r)}>
                    รับคืน
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
