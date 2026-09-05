import { Suspense } from 'react';
import BorrowerPage from '@/components/staff/BorrowerPage';

export const metadata = { title: 'ข้อมูลผู้ยืม' };

export default async function StaffBorrowerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <Suspense fallback={<div className="card"><div className="empty-state">กำลังโหลด...</div></div>}>
      <BorrowerPage borrowerId={id} />
    </Suspense>
  );
}
