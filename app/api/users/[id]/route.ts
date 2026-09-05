import bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { users } from '@/lib/db/schema';
import { ApiError, json, requireRole, route } from '@/lib/api';
import { logAction } from '@/lib/audit';

type Ctx = { params: Promise<{ id: string }> };

/** One staff account, for /staff/users/[id]. Admin only, like the list. */
export const GET = route<Ctx>(async (_req, { params }) => {
  await requireRole('admin');
  const { id } = await params;
  const [found] = await db.select().from(users).where(eq(users.userId, id));
  if (!found) throw new ApiError('ไม่พบเจ้าหน้าที่', 404);
  // The password hash never leaves the server, not even to an admin.
  return json({
    user: {
      user_id: found.userId,
      username: found.username,
      name: found.name,
      role: found.role,
      active: found.active,
      created_at: found.createdAt,
    },
  });
});

/**
 * Accounts are deactivated, never deleted. Every borrow, return and approval
 * records who performed it; removing the row would orphan that history and
 * make the audit trail unreadable. An inactive account cannot log in.
 */
export const DELETE = route<Ctx>(async (_req, { params }) => {
  const actor = await requireRole('admin');
  const { id } = await params;

  if (id === actor.user_id) {
    throw new ApiError('ปิดการใช้งานบัญชีของตัวเองไม่ได้', 409);
  }

  const [target] = await db.select().from(users).where(eq(users.userId, id));
  if (!target) throw new ApiError('ไม่พบเจ้าหน้าที่', 404);

  // Locking out the last admin would leave nobody able to manage the system.
  if (target.role === 'admin' && target.active) {
    const admins = await db.select().from(users).where(eq(users.role, 'admin'));
    if (admins.filter((a) => a.active).length <= 1) {
      throw new ApiError('ต้องมีแอดมินที่ใช้งานได้อย่างน้อย 1 คน', 409);
    }
  }

  const [updated] = await db
    .update(users)
    .set({ active: false })
    .where(eq(users.userId, id))
    .returning();

  await logAction({
    actor,
    action: 'deactivate_user',
    targetType: 'user',
    targetId: id,
    details: target.username,
  });

  return json({ user: { user_id: updated.userId, active: updated.active } });
});

export const PATCH = route<Ctx>(async (req, { params }) => {
  const actor = await requireRole('admin');
  const { id } = await params;
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;

  const [target] = await db.select().from(users).where(eq(users.userId, id));
  if (!target) throw new ApiError('ไม่พบเจ้าหน้าที่', 404);

  const patch: Partial<typeof users.$inferInsert> = {};
  const details: string[] = [];

  if (body.name !== undefined) {
    const name = String(body.name).trim();
    if (!name) throw new ApiError('ชื่อว่างไม่ได้');
    patch.name = name;
    details.push('ชื่อ');
  }
  if (body.role !== undefined) {
    const role = String(body.role);
    if (role !== 'admin' && role !== 'staff') throw new ApiError('สิทธิ์ไม่ถูกต้อง');
    if (target.role === 'admin' && role === 'staff' && target.active) {
      const admins = await db.select().from(users).where(eq(users.role, 'admin'));
      if (admins.filter((a) => a.active).length <= 1) {
        throw new ApiError('ต้องมีแอดมินที่ใช้งานได้อย่างน้อย 1 คน', 409);
      }
    }
    patch.role = role;
    details.push('สิทธิ์');
  }
  if (body.active !== undefined) {
    patch.active = Boolean(body.active);
    details.push(patch.active ? 'เปิดใช้งาน' : 'ปิดใช้งาน');
  }
  if (body.password !== undefined) {
    const password = String(body.password);
    if (password.length < 8) throw new ApiError('รหัสผ่านต้องยาวอย่างน้อย 8 ตัวอักษร');
    patch.passwordHash = bcrypt.hashSync(password, 10);
    details.push('รีเซ็ตรหัสผ่าน');
  }

  if (Object.keys(patch).length === 0) throw new ApiError('ไม่มีข้อมูลที่จะแก้ไข');

  const [updated] = await db.update(users).set(patch).where(eq(users.userId, id)).returning();

  await logAction({
    actor,
    action: 'update_user',
    targetType: 'user',
    targetId: id,
    details: `${target.username}: ${details.join(', ')}`,
  });

  return json({
    user: {
      user_id: updated.userId,
      username: updated.username,
      role: updated.role,
      name: updated.name,
      active: updated.active,
      created_at: updated.createdAt,
    },
  });
});
