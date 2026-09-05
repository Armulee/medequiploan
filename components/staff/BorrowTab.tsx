'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import Dialog, { DialogActions } from '@/components/Dialog';
import { api, apiJson } from '@/app/lib/api';
import { statusBadgeClass, thDate } from '@/app/lib/format';
import BorrowerSearch from './BorrowerSearch';
import type { BorrowerListItem, Equipment, LoanRecord } from '@/app/lib/types';

export default function BorrowTab() {
  // ?filter=overdue is what the dashboard's "เกินกำหนดคืน" tile links to.
  const initialFilter = useSearchParams().get('filter');
  const [picked, setPicked] = useState<BorrowerListItem | null>(null);
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [equipmentId, setEquipmentId] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [active, setActive] = useState<LoanRecord[] | null>(null);
  const [onlyOverdue, setOnlyOverdue] = useState(initialFilter === 'overdue');
  const [returning, setReturning] = useState<LoanRecord | null>(null);
  const [busy, setBusy] = useState(false);

  const loadEquipment = useCallback(() => {
    api<{ equipment: Equipment[] }>('/api/equipment')
      .then((d) => setEquipment(d.equipment))
      .catch((e) => toast.error(e instanceof Error ? e.message : 'โหลดรายการอุปกรณ์ไม่สำเร็จ'));
  }, []);

  const loadActive = useCallback(() => {
    api<{ records: LoanRecord[] }>('/api/records')
      .then((d) => setActive(d.records.filter((r) => r.status !== 'คืนแล้ว')))
      .catch((e) => {
        setActive([]);
        toast.error(e instanceof Error ? e.message : 'โหลดรายการยืมไม่สำเร็จ');
      });
  }, []);

  useEffect(() => {
    loadEquipment();
    loadActive();
  }, [loadEquipment, loadActive]);

  async function onBorrow(e: React.FormEvent) {
    e.preventDefault();
    if (!picked || !equipmentId) return;

    setBusy(true);
    try {
      await apiJson('/api/records', 'POST', {
        borrower_id: picked.borrower_id,
        equipment_id: equipmentId,
        due_date: dueDate || null,
      });
      toast.success(`บันทึกการยืมของ ${picked.first_name} ${picked.last_name} แล้ว`);
      setPicked(null);
      setEquipmentId('');
      setDueDate('');
      // Stock and the active list both changed, so refresh from the server
      // rather than adjusting local copies that could drift.
      loadEquipment();
      loadActive();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'บันทึกการยืมไม่สำเร็จ');
    } finally {
      setBusy(false);
    }
  }

  const shown = (active ?? []).filter((r) => !onlyOverdue || r.status === 'เกินกำหนด');

  return (
    <>
      <div className="card">
        <h1>บันทึกการยืม</h1>

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
          {!picked && <div className="hint">เลือกผู้ยืมจากรายการด้านบนก่อน</div>}
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
                  <div className="title">
                    <Link className="row-link" href={`/staff/records/${r.record_id}`}>
                      {r.equipment_name}
                    </Link>
                  </div>
                  <div className="sub">
                    {r.borrower_name} · ยืม {thDate(r.borrow_date)}
                    {r.due_date ? ` · ครบกำหนด ${thDate(r.due_date)}` : ''}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <span className={statusBadgeClass(r.status)}>{r.status}</span>
                  <button className="btn btn-sm btn-primary" onClick={() => setReturning(r)}>
                    รับคืน
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {returning && (
        <ReturnDialog
          record={returning}
          onClose={() => setReturning(null)}
          onDone={() => {
            setReturning(null);
            loadEquipment();
            loadActive();
          }}
        />
      )}
    </>
  );
}

/**
 * Receiving a return used window.prompt(), which cannot be styled, cannot
 * validate, and on a phone is a system sheet with no context at all.
 */
function ReturnDialog({
  record,
  onClose,
  onDone,
}: {
  record: LoanRecord;
  onClose: () => void;
  onDone: () => void;
}) {
  const [condition, setCondition] = useState('สภาพปกติ');
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await apiJson(`/api/records/${record.record_id}/return`, 'PUT', {
        condition_on_return: condition.trim(),
      });
      toast.success(`รับคืน ${record.equipment_name} เรียบร้อย`);
      onDone();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'บันทึกการคืนไม่สำเร็จ');
      setBusy(false);
    }
  }

  return (
    <Dialog
      title="รับคืนอุปกรณ์"
      subtitle={`${record.equipment_name} · ${record.borrower_name}`}
      onClose={onClose}
    >
      <form onSubmit={submit}>
        <div className="field">
          <label htmlFor="ret_condition">สภาพอุปกรณ์ตอนรับคืน</label>
          <textarea
            id="ret_condition"
            value={condition}
            onChange={(e) => setCondition(e.target.value)}
            placeholder="เช่น สภาพปกติ · ล้อหลวม ต้องซ่อม"
            autoFocus
          />
          <div className="hint">เว้นว่างได้ · จะแสดงในประวัติของอุปกรณ์ชิ้นนี้</div>
        </div>
        <DialogActions confirmLabel="ยืนยันรับคืน" onCancel={onClose} busy={busy} />
      </form>
    </Dialog>
  );
}
