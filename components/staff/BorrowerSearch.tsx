'use client';

import { useEffect, useState } from 'react';
import { Search } from 'lucide-react';
import { api } from '@/app/lib/api';
import type { BorrowerListItem } from '@/app/lib/types';

export default function BorrowerSearch({
  onPick,
  placeholder = 'ค้นหาด้วยชื่อ เบอร์โทร หรือเลขบัตรประชาชน',
}: {
  onPick: (b: BorrowerListItem) => void;
  placeholder?: string;
}) {
  const [q, setQ] = useState('');
  const [results, setResults] = useState<BorrowerListItem[] | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const term = q.trim();
    if (!term) {
      setResults(null);
      return;
    }
    // Debounce so typing a 13-digit ID doesn't fire thirteen queries.
    const t = setTimeout(() => {
      api<{ borrowers: BorrowerListItem[] }>(`/api/borrowers?q=${encodeURIComponent(term)}`)
        .then((d) => {
          setResults(d.borrowers);
          setError('');
        })
        .catch((e) => setError(e instanceof Error ? e.message : 'ค้นหาไม่สำเร็จ'));
    }, 300);
    return () => clearTimeout(t);
  }, [q]);

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

      {error && <div className="alert alert-error">{error}</div>}

      {results !== null &&
        (results.length === 0 ? (
          <div className="empty-state">ไม่พบผู้ยืม</div>
        ) : (
          <div className="list">
            {results.map((b) => (
              <button
                key={b.borrower_id}
                type="button"
                className="list-row"
                onClick={() => {
                  onPick(b);
                  setQ('');
                  setResults(null);
                }}
              >
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
        ))}
    </>
  );
}
