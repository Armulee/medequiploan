'use client';

import { useEffect, useState } from 'react';
import { api } from '@/app/lib/api';
import type { Equipment } from '@/app/lib/types';

export default function StockPreview() {
  const [items, setItems] = useState<Equipment[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    api<{ equipment: Equipment[] }>('/api/equipment')
      .then((d) => setItems(d.equipment))
      .catch(() => setFailed(true));
  }, []);

  if (failed) return <p style={{ color: 'var(--text-muted)' }}>ไม่สามารถโหลดข้อมูลได้ในขณะนี้</p>;
  if (!items) return <p style={{ color: 'var(--text-muted)' }}>กำลังโหลดข้อมูล...</p>;
  if (items.length === 0) return <p style={{ color: 'var(--text-muted)' }}>ยังไม่มีข้อมูลอุปกรณ์</p>;

  return (
    <>
      {items.slice(0, 6).map((e) => (
        <div className="stock-row" key={e.equipment_id}>
          <span className="name">{e.name}</span>
          <span className="avail">
            {e.available_qty > 0 ? `เหลือ ${e.available_qty} ชิ้น` : 'ไม่พร้อมให้ยืม'}
          </span>
        </div>
      ))}
    </>
  );
}
