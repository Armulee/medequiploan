import { Suspense } from 'react';
import HistoryPage from '@/components/staff/HistoryPage';

export const metadata = { title: 'ประวัติการใช้งาน' };

export default function StaffHistoryPage() {
  return (
    <Suspense fallback={<div className="card"><div className="empty-state">กำลังโหลด...</div></div>}>
      <HistoryPage />
    </Suspense>
  );
}
