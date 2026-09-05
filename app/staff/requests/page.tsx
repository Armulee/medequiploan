import { Suspense } from 'react';
import RequestsTab from '@/components/staff/RequestsTab';

export const metadata = { title: 'คำขอยืมอุปกรณ์' };

export default function StaffRequestsPage() {
  return (
    <Suspense fallback={<div className="card"><div className="empty-state">กำลังโหลด...</div></div>}>
      <RequestsTab />
    </Suspense>
  );
}
