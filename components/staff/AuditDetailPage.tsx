'use client';

import { useSession } from '@/app/staff/SessionContext';
import AdminOnly from './AdminOnly';
import AuditDetail from './AuditDetail';

export default function AuditDetailPage({ logId }: { logId: string }) {
  const { user } = useSession();
  if (!user) return null;
  if (user.role !== 'admin') return <AdminOnly />;
  return <AuditDetail logId={logId} />;
}
