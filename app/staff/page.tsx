'use client';

import { useState } from 'react';
import AppShell, { type TabId } from '@/components/staff/AppShell';
import BorrowTab from '@/components/staff/BorrowTab';
import DashboardTab from '@/components/staff/DashboardTab';
import HistoryTab from '@/components/staff/HistoryTab';
import LoginView from '@/components/staff/LoginView';
import RegisterTab from '@/components/staff/RegisterTab';
import RequestsTab from '@/components/staff/RequestsTab';
import StockTab from '@/components/staff/StockTab';
import { SessionProvider, useSession } from './SessionContext';

function StaffApp() {
  const { user, loading } = useSession();
  const [tab, setTab] = useState<TabId>('dashboard');

  // Hold the frame blank until /api/auth/me answers, so a logged-in staff
  // member never sees the login form flash before their session resolves.
  if (loading) return null;
  if (!user) return <LoginView />;

  return (
    <AppShell user={user} tab={tab} onTabChange={setTab}>
      {/* Remount each tab on switch: every tab loads its own data on mount, so
          stale figures from the previous tab are never shown. */}
      {tab === 'dashboard' && <DashboardTab />}
      {tab === 'register' && <RegisterTab />}
      {tab === 'borrow' && <BorrowTab />}
      {tab === 'requests' && <RequestsTab />}
      {tab === 'stock' && <StockTab isAdmin={user.role === 'admin'} />}
      {tab === 'history' && <HistoryTab />}
    </AppShell>
  );
}

export default function StaffPage() {
  return (
    <SessionProvider>
      <StaffApp />
    </SessionProvider>
  );
}
