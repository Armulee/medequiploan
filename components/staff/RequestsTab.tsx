'use client';

import { Phone } from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { api } from '@/app/lib/api';
import { statusBadgeClass, thDateTime } from '@/app/lib/format';
import DecisionDialog, { type Decision } from './DecisionDialog';
import type { BorrowRequest } from '@/app/lib/types';

const FILTERS = ['รอดำเนินการ', 'อนุมัติ', 'ปฏิเสธ', 'ทั้งหมด'] as const;
type Filter = (typeof FILTERS)[number];

function isFilter(v: string | null): v is Filter {
  return FILTERS.includes(v as Filter);
}

export default function RequestsTab() {
  const fromUrl = useSearchParams().get('status');
  const [filter, setFilter] = useState<Filter>(isFilter(fromUrl) ? fromUrl : 'รอดำเนินการ');
  const [items, setItems] = useState<BorrowRequest[] | null>(null);
  const [decision, setDecision] = useState<Decision | null>(null);

  const load = useCallback(() => {
    const qs = filter === 'ทั้งหมด' ? '' : `?status=${encodeURIComponent(filter)}`;
    setItems(null);
    api<{ requests: BorrowRequest[] }>(`/api/requests${qs}`)
      .then((d) => setItems(d.requests))
      .catch((e) => {
        toast.error(e instanceof Error ? e.message : 'โหลดคำขอไม่สำเร็จ');
        setItems([]);
      });
  }, [filter]);

  useEffect(load, [load]);

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
                  {/* The whole case for a decision — who they are, what they
                      already borrowed — is one link away. */}
                  <Link className="row-link" href={`/staff/requests/${r.request_id}`}>
                    {r.borrower_name}
                  </Link>
                  <span style={{ fontWeight: 400 }}>· {r.equipment_name}</span>
                </div>
                <div className="sub">
                  {r.request_id} · ส่งเมื่อ {thDateTime(r.requested_at)}
                  {r.note ? ` · ${r.note}` : ''}
                </div>
                {(r.borrower_phone || r.borrower_line_id) && (
                  <div className="sub contact-line">
                    <Phone size={14} />
                    {r.borrower_phone ? <a href={`tel:${r.borrower_phone}`}>{r.borrower_phone}</a> : '-'}
                    {r.borrower_line_id ? ` · LINE: ${r.borrower_line_id}` : ''}
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <span className={statusBadgeClass(r.status)}>{r.status}</span>
                {r.status === 'รอดำเนินการ' && (
                  <>
                    <button
                      className="btn btn-sm btn-primary"
                      onClick={() => setDecision({ request: r, kind: 'approve' })}
                    >
                      อนุมัติ
                    </button>
                    <button
                      className="btn btn-sm btn-outline"
                      onClick={() => setDecision({ request: r, kind: 'reject' })}
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

      {decision && (
        <DecisionDialog
          decision={decision}
          onClose={() => setDecision(null)}
          onDone={() => {
            setDecision(null);
            load();
          }}
        />
      )}
    </div>
  );
}
