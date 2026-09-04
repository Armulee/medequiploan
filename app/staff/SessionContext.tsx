'use client';

import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { api, apiJson } from '@/app/lib/api';
import type { SessionUser } from '@/app/lib/types';

type Ctx = {
  user: SessionUser | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
};

const SessionCtx = createContext<Ctx | null>(null);

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api<{ user: SessionUser | null }>('/api/auth/me')
      .then((d) => setUser(d.user))
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  const login = useCallback(async (username: string, password: string) => {
    const d = await apiJson<{ user: SessionUser }>('/api/auth/login', 'POST', { username, password });
    setUser(d.user);
  }, []);

  const logout = useCallback(async () => {
    await apiJson('/api/auth/logout', 'POST').catch(() => {});
    setUser(null);
  }, []);

  return (
    <SessionCtx.Provider value={{ user, loading, login, logout }}>{children}</SessionCtx.Provider>
  );
}

export function useSession(): Ctx {
  const ctx = useContext(SessionCtx);
  if (!ctx) throw new Error('useSession ต้องอยู่ภายใน SessionProvider');
  return ctx;
}
