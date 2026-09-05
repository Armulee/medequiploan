'use client';

import { useState } from 'react';
import AppShell, { type TabId } from '@/components/staff/AppShell';
import BorrowTab from '@/components/staff/BorrowTab';
import DashboardTab, { type DashboardJump } from '@/components/staff/DashboardTab';
import HistoryTab from '@/components/staff/HistoryTab';
import LoginView from '@/components/staff/LoginView';
import RegisterTab from '@/components/staff/RegisterTab';
import RequestsTab from '@/components/staff/RequestsTab';
import SettingsTab from '@/components/staff/SettingsTab';
import StockTab from '@/components/staff/StockTab';
import UsersTab from '@/components/staff/UsersTab';
import { Toaster } from '@/components/ui/toaster';
import { SessionProvider, useSession } from './SessionContext';

function StaffApp() {
  const { user, loading } = useSession();
  const [tab, setTab] = useState<TabId>('dashboard');
  // Set when a dashboard tile is clicked, so the destination tab opens showing
  // the subset that tile counted. Cleared once the tab has consumed it.
  const [jump, setJump] = useState<DashboardJump | null>(null);

  // Hold the frame blank until /api/auth/me answers, so a logged-in staff
  // member never sees the login form flash before their session resolves.
  if (loading) return null;
  if (!user) return <LoginView />;

  function goToTab(next: TabId) {
    setJump(null);
    setTab(next);
  }

  function handleJump(next: DashboardJump) {
    setJump(next);
    setTab(next.tab);
  }

  return (
    <AppShell user={user} tab={tab} onTabChange={goToTab}>
      {/* Remount each tab on switch: every tab loads its own data on mount, so
          stale figures from the previous tab are never shown. */}
      {tab === 'dashboard' && <DashboardTab onJump={handleJump} />}
      {tab === 'register' && <RegisterTab />}
      {tab === 'borrow' && (
        <BorrowTab initialFilter={jump?.tab === 'borrow' ? jump.filter : undefined} />
      )}
      {tab === 'requests' && (
        <RequestsTab initialFilter={jump?.tab === 'requests' ? jump.filter : undefined} />
      )}
      {tab === 'stock' && (
        <StockTab isAdmin={user.role === 'admin'} initialLowOnly={jump?.tab === 'stock'} />
      )}
      {tab === 'history' && <HistoryTab isAdmin={user.role === 'admin'} />}
      {tab === 'users' && user.role === 'admin' && <UsersTab currentUser={user} />}
      {tab === 'settings' && <SettingsTab user={user} />}
    </AppShell>
  );
}

export default function StaffPage() {
  return (
    <SessionProvider>
      <StaffApp />
      {/* Mounted here rather than in the root layout: only the staff app
          raises toasts, so the public pages do not ship sonner. */}
      <Toaster />
    </SessionProvider>
  );
}
