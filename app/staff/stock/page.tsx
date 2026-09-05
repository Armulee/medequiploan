import { Suspense } from 'react';
import StockPage from '@/components/staff/StockPage';

export const metadata = { title: 'สต็อกอุปกรณ์' };

export default function StaffStockPage() {
  return (
    <Suspense fallback={<div className="card"><div className="empty-state">กำลังโหลด...</div></div>}>
      <StockPage />
    </Suspense>
  );
}
