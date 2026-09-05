'use client';

import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { api, apiJson } from '@/app/lib/api';
import type { SessionUser } from '@/app/lib/types';

type Ctx = {
  user: SessionUser | null;
  loading: boolean;
  /**
   * How many passkeys this account has. Zero means it has never enrolled one,
   * and the app holds it at the enrolment screen until it does.
   */
  passkeys: number;
  login: (username: string, password: string) => Promise<void>;
  loginWithPasskey: () => Promise<void>;
  logout: () => Promise<void>;
  /** After the account behind the session changes its own name or username. */
  setUser: (user: SessionUser) => void;
  /** Re-read the session after enrolling or removing a passkey. */
  refresh: () => Promise<void>;
};

const SessionCtx = createContext<Ctx | null>(null);

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [passkeys, setPasskeys] = useState(0);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const d = await api<{ user: SessionUser | null; passkeys: number }>('/api/auth/me');
      setUser(d.user);
      setPasskeys(d.passkeys ?? 0);
    } catch {
      setUser(null);
      setPasskeys(0);
    }
  }, []);

  useEffect(() => {
    void refresh().finally(() => setLoading(false));
  }, [refresh]);

  const login = useCallback(async (username: string, password: string) => {
    const d = await apiJson<{ user: SessionUser }>('/api/auth/login', 'POST', { username, password });
    setUser(d.user);
    // A password sign-in only ever reaches an account with no passkey yet.
    setPasskeys(0);
  }, []);

  const loginWithPasskey = useCallback(async () => {
    const { startAuthentication } = await import('@simplewebauthn/browser');
    const start = await api<{ options: Parameters<typeof startAuthentication>[0]['optionsJSON']; challenge_id: string }>(
      '/api/auth/passkey/login'
    );
    const response = await startAuthentication({ optionsJSON: start.options });
    const d = await apiJson<{ user: SessionUser }>('/api/auth/passkey/login', 'POST', {
      challenge_id: start.challenge_id,
      response,
    });
    setUser(d.user);
    await refresh();
  }, [refresh]);

  const logout = useCallback(async () => {
    await apiJson('/api/auth/logout', 'POST').catch(() => {});
    setUser(null);
    setPasskeys(0);
  }, []);

  return (
    <SessionCtx.Provider
      value={{ user, loading, passkeys, login, loginWithPasskey, logout, setUser, refresh }}
    >
      {children}
    </SessionCtx.Provider>
  );
}

export function useSession(): Ctx {
  const ctx = useContext(SessionCtx);
  if (!ctx) throw new Error('useSession ต้องอยู่ภายใน SessionProvider');
  return ctx;
}
