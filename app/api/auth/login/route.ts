import bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { users } from '@/lib/db/schema';
import { ApiError, json, route } from '@/lib/api';
import { logAction } from '@/lib/audit';
import { getSession, type SessionUser } from '@/lib/session';
import { RULES, clientIp, hit, reset, sweepExpired, tooManyRequests } from '@/lib/rate-limit';

export const POST = route(async (req: Request) => {
  const { username, password } = (await req.json().catch(() => ({}))) as {
    username?: string;
    password?: string;
  };
  if (!username || !password) throw new ApiError('กรุณากรอกชื่อผู้ใช้และรหัสผ่าน');

  void sweepExpired();

  const ip = clientIp(req);
  const userKey = `login:user:${username.toLowerCase()}`;
  const ipKey = `login:ip:${ip}`;

  // Check both buckets before touching the password. Per-account stops a
  // targeted guess at one login; per-address stops the same client spraying
  // many usernames, which the per-account limit alone would never see.
  const [byUser, byIp] = await Promise.all([hit(userKey, RULES.loginPerUser), hit(ipKey, RULES.loginPerIp)]);
  if (!byUser.allowed || !byIp.allowed) {
    const retryAfter = Math.max(
      byUser.allowed ? 0 : byUser.retryAfterSeconds,
      byIp.allowed ? 0 : byIp.retryAfterSeconds
    );
    await logAction({
      actor: null,
      action: 'login_rate_limited',
      targetType: 'user',
      targetId: username.slice(0, 32),
      details: `ip=${ip}`,
    });
    throw tooManyRequests(retryAfter);
  }

  const [found] = await db.select().from(users).where(eq(users.username, username));

  // Compare against a dummy hash when the user is missing so a wrong username
  // and a wrong password take the same time to answer.
  const hash = found?.passwordHash ?? '$2a$10$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvalidiu';
  const ok = await bcrypt.compare(password, hash);
  if (!found || !found.active || !ok) {
    throw new ApiError('ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง', 401);
  }

  const user: SessionUser = {
    user_id: found.userId,
    username: found.username,
    role: found.role as SessionUser['role'],
    name: found.name,
  };

  const session = await getSession();
  session.user = user;
  await session.save();

  // Only failures should count towards the limit, so clear both buckets on a
  // success. Otherwise staff who sign in and out through the day would lock
  // themselves out without ever typing a wrong password.
  await Promise.all([reset(userKey), reset(ipKey)]);

  await logAction({ actor: user, action: 'login', targetType: 'user', targetId: user.user_id });
  return json({ user });
});
