import { Suspense } from 'react';
import LendTab from '@/components/staff/LendTab';

export const metadata = { title: 'บันทึกการยืม' };

export default function StaffLendPage() {
  return (
    <Suspense fallback={<div className="card"><div className="empty-state">กำลังโหลด...</div></div>}>
      <LendTab />
    </Suspense>
  );
}
