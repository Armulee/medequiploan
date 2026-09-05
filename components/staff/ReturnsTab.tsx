'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useCallback, useState } from 'react';
import { toast } from 'sonner';
import Dialog, { DialogActions } from '@/components/Dialog';
import { api, apiJson } from '@/app/lib/api';
import { statusBadgeClass, thDate } from '@/app/lib/format';
import { ListCount, ListMore, PAGE_SIZE, useInfiniteList } from './InfiniteList';
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
  const [onlyOverdue, setOnlyOverdue] = useState(initialFilter === 'overdue');
  const [returning, setReturning] = useState<LoanRecord | null>(null);

  // "Still out" and "overdue" are both computed from the due date at read
  // time, so the server decides them; the page asks for the one it wants
  // rather than downloading every loan ever made and filtering the array.
  const fetchPage = useCallback(
    async (offset: number, limit: number) => {
      const qs = new URLSearchParams({
        status: onlyOverdue ? 'เกินกำหนด' : 'active',
        limit: String(limit),
        offset: String(offset),
      });
      const d = await api<{ records: LoanRecord[]; total: number }>(`/api/records?${qs}`);
      return { items: d.records, total: d.total };
    },
    [onlyOverdue]
  );

  const { items, total, loadingMore, sentinelRef, reload } = useInfiniteList(fetchPage, PAGE_SIZE);
  const shown = items ?? [];

  return (
    <>
      <div className="card">
        {/* Heading, then what the page is for, then the filter — the same
            order as the lend page. With the filter beside the heading it
            landed above the sentence explaining it once the card head
            stacked on a phone. */}
        <h1>บันทึกการคืน</h1>
        <p style={{ color: 'var(--text-muted)', marginTop: -6 }}>
          อุปกรณ์ที่ยังอยู่กับผู้ยืม · กด “รับคืน” เมื่อของกลับเข้าศูนย์
          {' · '}
          <Link href="/staff/lend">จ่ายอุปกรณ์ให้ผู้ยืม</Link>
        </p>

        <div className="filter-row">
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

        {items === null ? (
          <div className="empty-state">กำลังโหลด...</div>
        ) : shown.length === 0 ? (
          <div className="empty-state">
            {onlyOverdue ? 'ไม่มีรายการเกินกำหนด' : 'ไม่มีอุปกรณ์ที่ยังไม่ได้คืน'}
          </div>
        ) : (
          <>
          <ListCount shown={shown.length} total={total} />
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
          <ListMore
            sentinelRef={sentinelRef}
            loading={loadingMore}
            shown={shown.length}
            total={total}
          />
          </>
        )}
      </div>

      {returning && (
        <ReturnDialog
          record={returning}
          onClose={() => setReturning(null)}
          onDone={() => {
            setReturning(null);
            reload();
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
