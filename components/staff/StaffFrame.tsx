'use client';

import { useSession } from '@/app/staff/SessionContext';
import AppShell from './AppShell';
import LoginView from './LoginView';
import PasskeySetup from './PasskeySetup';

/**
 * The login gate. It sits in the layout rather than in each page so signing in
 * once covers every staff route, and so switching tabs never re-checks the
 * session.
 */
export default function StaffFrame({ children }: { children: React.ReactNode }) {
  const { user, loading, passkeys } = useSession();

  // Hold the frame blank until /api/auth/me answers, so a logged-in staff
  // member never sees the login form flash before their session resolves.
  if (loading) return null;
  if (!user) return <LoginView />;

  // Signed in, but the account has never enrolled a passkey — which only
  // happens on a first sign-in or after an admin reset. Nothing else renders
  // until it does. This is the enforcement point for "staff must use a
  // passkey"; the server backs it up by refusing password sign-in once one
  // exists, so an account cannot linger on passwords by avoiding this screen.
  if (passkeys === 0) return <PasskeySetup />;

  return <AppShell user={user}>{children}</AppShell>;
}
