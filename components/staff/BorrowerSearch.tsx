'use client';

import { useEffect, useState } from 'react';
import { Search } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/app/lib/api';
import type { BorrowerListItem } from '@/app/lib/types';

/** Enough to pick someone registered today without typing anything. */
const RECENT_LIMIT = 25;

export default function BorrowerSearch({
  onPick,
  placeholder = 'ค้นหาด้วยชื่อ เบอร์โทร หรือเลขบัตรประชาชน',
}: {
  onPick: (b: BorrowerListItem) => void;
  placeholder?: string;
}) {
  const [q, setQ] = useState('');
  const [results, setResults] = useState<BorrowerListItem[] | null>(null);
  // An empty box used to show nothing at all, so the most common case —
  // "the person I just registered" — required typing their name first.
  const [recent, setRecent] = useState<BorrowerListItem[] | null>(null);

  useEffect(() => {
    api<{ borrowers: BorrowerListItem[] }>('/api/borrowers')
      .then((d) => setRecent(d.borrowers))
      .catch((e) => {
        setRecent([]);
        toast.error(e instanceof Error ? e.message : 'โหลดรายชื่อผู้ยืมไม่สำเร็จ');
      });
  }, []);

  useEffect(() => {
    const term = q.trim();
    if (!term) {
      setResults(null);
      return;
    }
    // Debounce so typing a 13-digit ID doesn't fire thirteen queries.
    const t = setTimeout(() => {
      api<{ borrowers: BorrowerListItem[] }>(`/api/borrowers?q=${encodeURIComponent(term)}`)
        .then((d) => setResults(d.borrowers))
        .catch((e) => toast.error(e instanceof Error ? e.message : 'ค้นหาไม่สำเร็จ'));
    }, 300);
    return () => clearTimeout(t);
  }, [q]);

  const searching = q.trim().length > 0;
  const shown = searching ? results : recent?.slice(0, RECENT_LIMIT) ?? null;

  function pick(b: BorrowerListItem) {
    onPick(b);
    setQ('');
    setResults(null);
  }

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

      {!searching && recent !== null && recent.length > RECENT_LIMIT && (
        <div className="hint" style={{ marginBottom: 6 }}>
          แสดงผู้ยืม {RECENT_LIMIT} คนล่าสุด จากทั้งหมด {recent.length} คน · พิมพ์เพื่อค้นหาคนอื่น
        </div>
      )}

      {shown === null ? (
        <div className="empty-state">กำลังโหลด...</div>
      ) : shown.length === 0 ? (
        <div className="empty-state">{searching ? 'ไม่พบผู้ยืม' : 'ยังไม่มีผู้ยืมในระบบ'}</div>
      ) : (
        <div className="list">
          {shown.map((b) => (
            <button key={b.borrower_id} type="button" className="list-row" onClick={() => pick(b)}>
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
              <span className="badge badge-active">เลือก</span>
            </button>
          ))}
        </div>
      )}
    </>
  );
}
