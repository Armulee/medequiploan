import { eq } from 'drizzle-orm';
import { db } from './db';
import { users } from './db/schema';
import { ApiError } from './errors';
import { currentSession, type SessionUser } from './session';

/**
 * Resolve the caller from the cookie AND from the users table.
 *
 * The cookie alone used to be enough. It is signed, so it cannot be forged,
 * but it is a snapshot: an account closed after a member of staff left, or a
 * password changed because it had leaked, went on working until the cookie
 * expired eight hours later. For a system holding photographs of ID cards,
 * "revoked" has to mean revoked on the next request.
 *
 * The row is also where name, username and role are read from now, so a
 * demotion from admin to staff applies immediately instead of at next sign-in.
 *
 * One indexed lookup per authenticated request. That is the price of the
 * guarantee, and at this system's traffic it is not a meaningful one.
 */
export async function requireActiveUser(): Promise<SessionUser> {
  const session = await currentSession();
  if (!session) {
    throw new ApiError('ต้องเข้าสู่ระบบก่อนใช้งานส่วนนี้ (login required)', 401);
  }

  const [row] = await db
    .select({
      userId: users.userId,
      username: users.username,
      role: users.role,
      name: users.name,
      active: users.active,
      sessionVersion: users.sessionVersion,
    })
    .from(users)
    .where(eq(users.userId, session.user.user_id));

  if (!row || !row.active) {
    throw new ApiError('บัญชีนี้ถูกปิดการใช้งานแล้ว กรุณาติดต่อผู้ดูแลระบบ', 401);
  }
  if (row.sessionVersion !== session.v) {
    throw new ApiError('เซสชันหมดอายุแล้ว (มีการเปลี่ยนรหัสผ่านหรือความปลอดภัย) กรุณาเข้าสู่ระบบใหม่', 401);
  }

  return {
    user_id: row.userId,
    username: row.username,
    role: row.role as SessionUser['role'],
    name: row.name,
  };
}

/**
 * The same check, but as a question rather than a demand.
 *
 * For `GET /api/auth/me`, which is asking "is anyone signed in?" — a revoked
 * cookie is a legitimate answer of "no", not an error. It has to run the full
 * check rather than read the cookie: the staff app decides whether to render
 * the whole application from this one response, so trusting the snapshot here
 * would put a closed account back inside the app until its first data fetch
 * failed.
 */
export async function activeUserOrNull(): Promise<SessionUser | null> {
  try {
    return await requireActiveUser();
  } catch {
    return null;
  }
}
