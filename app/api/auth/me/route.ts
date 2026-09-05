import bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { users } from '@/lib/db/schema';
import { ApiError, json, requireAuth, route } from '@/lib/api';
import { logAction } from '@/lib/audit';
import { RULES, hit } from '@/lib/rate-limit';
import { currentUser, saveSession } from '@/lib/session';

export const GET = route(async () => json({ user: await currentUser() }));

/**
 * Staff changing their own account, and only their own — the id comes from
 * the session, never from the request, so this cannot be pointed at somebody
 * else's row. Role and active status are deliberately not editable here:
 * those are an admin's business, on /api/users/[id].
 */
export const PATCH = route(async (req) => {
  const actor = await requireAuth();
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;

  const [me] = await db.select().from(users).where(eq(users.userId, actor.user_id));
  if (!me) throw new ApiError('ไม่พบบัญชีของคุณ', 404);

  const wantsUsername =
    body.username !== undefined && String(body.username).trim() !== me.username;
  const wantsPassword = body.password !== undefined && String(body.password) !== '';

  // Changing what you sign in with needs the password you sign in with, so an
  // unlocked screen someone walked away from cannot be used to take the
  // account over.
  if (wantsUsername || wantsPassword) {
    const limit = await hit(`account:${me.userId}`, RULES.accountChangePerUser);
    if (!limit.allowed) {
      throw new ApiError(
        'ยืนยันรหัสผ่านผิดหลายครั้งเกินไป กรุณารอสักครู่แล้วลองใหม่',
        429,
        limit.retryAfterSeconds
      );
    }
    const ok = await bcrypt.compare(String(body.current_password ?? ''), me.passwordHash);
    if (!ok) throw new ApiError('รหัสผ่านปัจจุบันไม่ถูกต้อง', 403);
  }

  const patch: Partial<typeof users.$inferInsert> = {};
  const changed: string[] = [];

  if (body.name !== undefined) {
    const name = String(body.name).trim();
    if (!name) throw new ApiError('ชื่อว่างไม่ได้');
    if (name !== me.name) {
      patch.name = name;
      changed.push('ชื่อที่แสดง');
    }
  }

  if (wantsUsername) {
    const username = String(body.username).trim().toLowerCase();
    if (username.length < 3) throw new ApiError('ชื่อผู้ใช้ต้องยาวอย่างน้อย 3 ตัวอักษร');
    if (!/^[a-z0-9._-]+$/.test(username)) {
      throw new ApiError('ชื่อผู้ใช้ใช้ได้เฉพาะ a-z 0-9 . _ - เท่านั้น');
    }
    const [taken] = await db.select().from(users).where(eq(users.username, username));
    if (taken) throw new ApiError('ชื่อผู้ใช้นี้ถูกใช้แล้ว', 409);
    patch.username = username;
    changed.push('ชื่อผู้ใช้');
  }

  if (wantsPassword) {
    const password = String(body.password);
    if (password.length < 8) throw new ApiError('รหัสผ่านต้องยาวอย่างน้อย 8 ตัวอักษร');
    if (await bcrypt.compare(password, me.passwordHash)) {
      throw new ApiError('รหัสผ่านใหม่ต้องไม่ซ้ำกับรหัสผ่านเดิม');
    }
    patch.passwordHash = bcrypt.hashSync(password, 10);
    changed.push('รหัสผ่าน');
  }

  if (changed.length === 0) throw new ApiError('ไม่มีข้อมูลที่เปลี่ยนแปลง');

  const [updated] = await db
    .update(users)
    .set(patch)
    .where(eq(users.userId, me.userId))
    .returning();

  // The session carries the name and username, so it has to be rewritten or
  // the header keeps showing the old ones until the next sign-in.
  const nextUser = {
    user_id: updated.userId,
    username: updated.username,
    role: updated.role as 'admin' | 'staff',
    name: updated.name,
  };
  await saveSession(nextUser);

  // The password itself is never logged, only that it changed.
  await logAction({
    actor,
    action: 'update_own_account',
    targetType: 'user',
    targetId: me.userId,
    details: changed.join(', '),
  });

  return json({ user: nextUser });
});
