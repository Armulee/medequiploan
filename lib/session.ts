import { getIronSession, type IronSession, type SessionOptions } from 'iron-session';
import { cookies } from 'next/headers';
import { ConfigError } from './api';

export type SessionUser = {
  user_id: string;
  username: string;
  role: 'admin' | 'staff';
  name: string;
};

export type SessionData = { user?: SessionUser };

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
