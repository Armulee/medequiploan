'use client';

import { Search } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { api } from '@/app/lib/api';
import { ListCount, ListMore, PAGE_SIZE, useInfiniteList } from './InfiniteList';
import type { BorrowerListItem } from '@/app/lib/types';

export default function BorrowerSearch({
  onPick,
  placeholder = 'ค้นหาด้วยชื่อ เบอร์โทร หรือเลขบัตรประชาชน',
  pickLabel = 'เลือก',
}: {
  onPick: (b: BorrowerListItem) => void;
  placeholder?: string;
  /** What clicking a row will do — "เลือก" when picking, "จ่ายอุปกรณ์" when lending. */
  pickLabel?: string;
}) {
  const [q, setQ] = useState('');
  // Debounced so typing a 13-digit ID doesn't fire thirteen queries — and so
  // the list only resets once the person has stopped typing.
  const [term, setTerm] = useState('');

  useEffect(() => {
    const t = setTimeout(() => setTerm(q.trim()), 300);
    return () => clearTimeout(t);
  }, [q]);

  // An empty box used to show nothing at all, so the most common case —
  // "the person I just registered" — required typing their name first.
  const fetchPage = useCallback(
    async (offset: number, limit: number) => {
      const qs = new URLSearchParams({ limit: String(limit), offset: String(offset) });
      if (term) qs.set('q', term);
      const d = await api<{ borrowers: BorrowerListItem[]; total: number }>(
        `/api/borrowers?${qs}`
      );
      return { items: d.borrowers, total: d.total };
    },
    [term]
  );

  const { items, total, loadingMore, sentinelRef } = useInfiniteList(fetchPage, PAGE_SIZE);

  return (
    <>
      <div className="field">
        <label htmlFor="borrowerSearch">
          <Search size={15} /> ค้นหาผู้ยืม
        </label>
        <input
          id="borrowerSearch"
          type="search"
          placeholder={placeholder}
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>

      {items === null ? (
        <div className="empty-state">กำลังโหลด...</div>
      ) : items.length === 0 ? (
        <div className="empty-state">{term ? 'ไม่พบผู้ยืม' : 'ยังไม่มีผู้ยืมในระบบ'}</div>
      ) : (
        <>
          <ListCount shown={items.length} total={total} noun="คน" />
          <div className="list">
            {items.map((b) => (
              <button key={b.borrower_id} type="button" className="list-row" onClick={() => onPick(b)}>
                <div>
                  <div className="title">
                    {b.first_name} {b.last_name}
                  </div>
                  <div className="sub">
                    {b.borrower_id} · {b.national_id_masked}
                    {b.phone ? ` · ${b.phone}` : ''}
                    {!b.verified && ' · มาจากฟอร์มออนไลน์'}
                  </div>
                </div>
                <span className="badge badge-active">{pickLabel}</span>
              </button>
            ))}
          </div>
          <ListMore
            sentinelRef={sentinelRef}
            loading={loadingMore}
            shown={items.length}
            total={total}
          />
        </>
      )}
    </>
  );
}
