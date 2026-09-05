import { getIronSession, type IronSession, type SessionOptions } from 'iron-session';
import { cookies } from 'next/headers';
import { ConfigError } from './errors';

export type SessionUser = {
  user_id: string;
  username: string;
  role: 'admin' | 'staff';
  name: string;
};

/**
 * What the cookie actually carries.
 *
 * `v` is the account's session version at the moment of sign-in. Every request
 * compares it against the row (see lib/auth.ts), so bumping the column
 * invalidates every cookie ever issued for that account — which is what makes
 * "close this account" and "change my password" take effect now rather than
 * in up to eight hours.
 */
export type SessionData = { user?: SessionUser; v?: number };

// The old Express app fell back to a hardcoded secret when SESSION_SECRET was
// unset. Since cookie-session signs the user object client-side, anyone who
// knew that fallback could forge an admin cookie. Refuse to boot instead.
function sessionSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new ConfigError(
      'ไม่พบ SESSION_SECRET หรือสั้นเกินไป (ต้องยาวอย่างน้อย 32 ตัวอักษร) ' +
        'ตั้งใน Vercel Project Settings · สุ่มด้วย: openssl rand -base64 48'
    );
  }
  return secret;
}

export function sessionOptions(): SessionOptions {
  return {
    password: sessionSecret(),
    cookieName: 'medequip.sid',
    ttl: 8 * 60 * 60, // 8 ชั่วโมง
    cookieOptions: {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
    },
  };
}

export async function getSession(): Promise<IronSession<SessionData>> {
  return getIronSession<SessionData>(await cookies(), sessionOptions());
}

export async function currentUser(): Promise<SessionUser | null> {
  const session = await getSession();
  return session.user ?? null;
}

/** The signed-in account together with the version its cookie was issued at. */
export async function currentSession(): Promise<{ user: SessionUser; v: number } | null> {
  const session = await getSession();
  if (!session.user) return null;
  return { user: session.user, v: session.v ?? 0 };
}

/**
 * Rewrite the signed cookie after the account behind it changed. Without this
 * the header keeps showing the old name and username until the next sign-in,
 * because the session is a snapshot rather than a lookup.
 */
export async function saveSession(user: SessionUser, version: number): Promise<void> {
  const session = await getSession();
  session.user = user;
  session.v = version;
  await session.save();
}
