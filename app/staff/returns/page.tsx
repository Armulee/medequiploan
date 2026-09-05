import { Suspense } from 'react';
import ReturnsTab from '@/components/staff/ReturnsTab';

export const metadata = { title: 'บันทึกการคืน' };

export default function StaffReturnsPage() {
  return (
    <Suspense fallback={<div className="card"><div className="empty-state">กำลังโหลด...</div></div>}>
      <ReturnsTab />
    </Suspense>
  );
}
