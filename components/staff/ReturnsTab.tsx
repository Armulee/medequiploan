'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import Dialog, { DialogActions } from '@/components/Dialog';
import { api, apiJson } from '@/app/lib/api';
import { statusBadgeClass, thDate } from '@/app/lib/format';
import type { LoanRecord } from '@/app/lib/types';

/**
 * Receiving things back, and nothing else. Handing an item out used to share
 * this page, which meant the borrower picker and the equipment select sat on
 * top of the list of everything already out — two different jobs, one screen.
 * Lending now starts from the person (/staff/lend), so this page is the queue
 * of what is still on loan.
 */
export default function ReturnsTab() {
  // ?filter=overdue is what the dashboard's "เกินกำหนดคืน" tile links to.
  const initialFilter = useSearchParams().get('filter');
  const [active, setActive] = useState<LoanRecord[] | null>(null);
  const [onlyOverdue, setOnlyOverdue] = useState(initialFilter === 'overdue');
  const [returning, setReturning] = useState<LoanRecord | null>(null);

  const load = useCallback(() => {
    api<{ records: LoanRecord[] }>('/api/records')
      .then((d) => setActive(d.records.filter((r) => r.status !== 'คืนแล้ว')))
      .catch((e) => {
        setActive([]);
        toast.error(e instanceof Error ? e.message : 'โหลดรายการยืมไม่สำเร็จ');
      });
  }, []);

  useEffect(load, [load]);

  const shown = (active ?? []).filter((r) => !onlyOverdue || r.status === 'เกินกำหนด');
  const overdueCount = (active ?? []).filter((r) => r.status === 'เกินกำหนด').length;

  return (
    <>
      <div className="card">
        <div className="card-head">
          <h1>บันทึกการคืน</h1>
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
              เกินกำหนด{overdueCount > 0 ? ` (${overdueCount})` : ''}
            </button>
          </div>
        </div>
        <p style={{ color: 'var(--text-muted)', marginTop: -2 }}>
          อุปกรณ์ที่ยังอยู่กับผู้ยืม · กด “รับคืน” เมื่อของกลับเข้าศูนย์
          {' · '}
          <Link href="/staff/lend">จ่ายอุปกรณ์ให้ผู้ยืม</Link>
        </p>

        {active === null ? (
          <div className="empty-state">กำลังโหลด...</div>
        ) : shown.length === 0 ? (
          <div className="empty-state">
            {onlyOverdue ? 'ไม่มีรายการเกินกำหนด' : 'ไม่มีอุปกรณ์ที่ยังไม่ได้คืน'}
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
            load();
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
