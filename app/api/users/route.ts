import bcrypt from 'bcryptjs';
import { asc, desc, eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { users } from '@/lib/db/schema';
import { ApiError, json, requireRole, route } from '@/lib/api';
import { logAction } from '@/lib/audit';
import { passwordProblem } from '@/lib/password';


function userView(u: typeof users.$inferSelect) {
  // The password hash never leaves the server, not even to an admin.
  return {
    user_id: u.userId,
    username: u.username,
    role: u.role,
    name: u.name,
    active: u.active,
    created_at: u.createdAt,
  };
}

export const GET = route(async (req: Request) => {
  await requireRole('admin');
  const sp = new URL(req.url).searchParams;
  const sort = sp.get('sort') === 'name' ? users.name : users.createdAt;
  const dir = sp.get('order') === 'asc' ? asc : desc;

  // Not paged: a foundation has a handful of staff accounts, and the page
  // filters and sorts them in the browser. The count still ships so the list
  // header reads the same as every other list.
  const rows = await db.select().from(users).orderBy(dir(sort), desc(users.userId));
  return json({ users: rows.map(userView), total: rows.length });
});

export const POST = route(async (req: Request) => {
  const actor = await requireRole('admin');
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;

  const username = String(body.username ?? '').trim().toLowerCase();
  const name = String(body.name ?? '').trim();
  const password = String(body.password ?? '');
  const role = String(body.role ?? 'staff');

  if (!/^[a-z0-9._-]{3,64}$/.test(username)) {
    throw new ApiError('ชื่อผู้ใช้ต้องเป็นตัวอักษรอังกฤษพิมพ์เล็ก ตัวเลข . _ - ยาว 3-64 ตัว');
  }
  if (!name) throw new ApiError('กรุณากรอกชื่อ-นามสกุลของเจ้าหน้าที่');
  const weak = passwordProblem(password, [username, name]);
  if (weak) throw new ApiError(weak);
  if (role !== 'admin' && role !== 'staff') throw new ApiError('สิทธิ์ไม่ถูกต้อง');

  const [existing] = await db.select().from(users).where(eq(users.username, username));
  if (existing) throw new ApiError(`ชื่อผู้ใช้ "${username}" ถูกใช้ไปแล้ว`, 409);

  const [created] = await db
    .insert(users)
    .values({ username, name, role, passwordHash: bcrypt.hashSync(password, 10), active: true })
    .returning();

  await logAction({
    actor,
    action: 'create_user',
    targetType: 'user',
    targetId: created.userId,
    details: `${username} (${role})`,
  });

  return json({ user: userView(created) }, 201);
});
