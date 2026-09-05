'use client';

import { useSession } from '@/app/staff/SessionContext';
import AppShell from './AppShell';
import LoginView from './LoginView';

/**
 * The login gate. It sits in the layout rather than in each page so signing in
 * once covers every staff route, and so switching tabs never re-checks the
 * session.
 */
export default function StaffFrame({ children }: { children: React.ReactNode }) {
  const { user, loading } = useSession();

  // Hold the frame blank until /api/auth/me answers, so a logged-in staff
  // member never sees the login form flash before their session resolves.
  if (loading) return null;
  if (!user) return <LoginView />;

  return <AppShell user={user}>{children}</AppShell>;
}
