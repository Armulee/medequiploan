'use client';

import { useSession } from '@/app/staff/SessionContext';
import HistoryTab from './HistoryTab';

export default function HistoryPage() {
  const { user } = useSession();
  if (!user) return null;
  return <HistoryTab isAdmin={user.role === 'admin'} />;
}
