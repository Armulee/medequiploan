import { Suspense } from 'react';
import BorrowTab from '@/components/staff/BorrowTab';

export const metadata = { title: 'บันทึกการยืม' };

export default function StaffBorrowPage() {
  return (
    <Suspense fallback={<div className="card"><div className="empty-state">กำลังโหลด...</div></div>}>
      <BorrowTab />
    </Suspense>
  );
}
