import bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { users } from '@/lib/db/schema';
import { ApiError, json, route } from '@/lib/api';
import { logAction } from '@/lib/audit';
import { getSession, type SessionUser } from '@/lib/session';

export const POST = route(async (req: Request) => {
  const { username, password } = (await req.json().catch(() => ({}))) as {
    username?: string;
    password?: string;
  };
  if (!username || !password) throw new ApiError('กรุณากรอกชื่อผู้ใช้และรหัสผ่าน');

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

  await logAction({ actor: user, action: 'login', targetType: 'user', targetId: user.user_id });
  return json({ user });
});
