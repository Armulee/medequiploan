import bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { users } from '@/lib/db/schema';
import { ApiError, json, route } from '@/lib/api';
import { logAction } from '@/lib/audit';
import { saveSession, type SessionUser } from '@/lib/session';
import { passkeyCount } from '@/lib/webauthn';
import { RULES, clientIp, hit, reset, sweepExpired, tooManyRequests } from '@/lib/rate-limit';

export const POST = route(async (req: Request) => {
  const { username, password } = (await req.json().catch(() => ({}))) as {
    username?: string;
    password?: string;
  };
  if (!username || !password) throw new ApiError('กรุณากรอกชื่อผู้ใช้และรหัสผ่าน');

  void sweepExpired();

  const ip = clientIp(req);
  const name = username.toLowerCase();
  // Keyed on the pair. A username-only bucket let anyone lock the real admin
  // out for as long as they cared to keep a script running.
  const pairKey = `login:pair:${name}:${ip}`;
  const ipKey = `login:ip:${ip}`;
  const userKey = `login:user:${name}`;

  // Three buckets: this client against this account, this client against
  // every account, and every client against this account. The last is the
  // backstop for a distributed guess and is set high enough that real people
  // mistyping their own password never reach it.
  const [byPair, byIp, byUser] = await Promise.all([
    hit(pairKey, RULES.loginPerUserIp),
    hit(ipKey, RULES.loginPerIp),
    hit(userKey, RULES.loginPerUserGlobal),
  ]);
  if (!byPair.allowed || !byIp.allowed || !byUser.allowed) {
    const retryAfter = Math.max(
      byPair.allowed ? 0 : byPair.retryAfterSeconds,
      byIp.allowed ? 0 : byIp.retryAfterSeconds,
      byUser.allowed ? 0 : byUser.retryAfterSeconds
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

  // Once an account holds a passkey, its password is no longer a way in. It
  // stays only as the bootstrap credential for enrolling the first one, and
  // as what an admin reset hands out — leaving it live afterwards would keep
  // the phishable path open beside the unphishable one, and an attacker
  // always picks the phishable one.
  const enrolled = await passkeyCount(found.userId);
  if (enrolled > 0) {
    throw new ApiError(
      'บัญชีนี้ตั้งพาสคีย์ไว้แล้ว กรุณาเข้าสู่ระบบด้วยพาสคีย์ · ถ้าอุปกรณ์หาย ให้แอดมินรีเซ็ตพาสคีย์ให้',
      403
    );
  }

  const user: SessionUser = {
    user_id: found.userId,
    username: found.username,
    role: found.role as SessionUser['role'],
    name: found.name,
  };

  await saveSession(user, found.sessionVersion);

  // Only failures should count towards the limit, so clear the buckets on a
  // success. Otherwise staff who sign in and out through the day would lock
  // themselves out without ever typing a wrong password.
  await Promise.all([reset(pairKey), reset(ipKey), reset(userKey)]);

  await logAction({ actor: user, action: 'login', targetType: 'user', targetId: user.user_id });
  return json({ user });
});
