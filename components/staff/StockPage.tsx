'use client';

import { useSearchParams } from 'next/navigation';
import { useSession } from '@/app/staff/SessionContext';
import StockTab from './StockTab';

export default function StockPage() {
  const { user } = useSession();
  // ?low=1 is what the dashboard's "อุปกรณ์ใกล้หมด" tile links to.
  const lowOnly = useSearchParams().get('low') === '1';
  if (!user) return null;
  return <StockTab isAdmin={user.role === 'admin'} initialLowOnly={lowOnly} />;
}
