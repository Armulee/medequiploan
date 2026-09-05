import { eq } from 'drizzle-orm';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { db } from '@/lib/db';
import { passkeys, users } from '@/lib/db/schema';
import { ApiError, json, requireRole, route } from '@/lib/api';
import { logAction } from '@/lib/audit';

type Ctx = { params: Promise<{ id: string }> };

/**
 * The way back in when someone loses the device holding their passkey.
 *
 * Without this, a lost phone is a permanently locked account — the failure
 * mode that stops organisations adopting passkeys at all. Every passkey on
 * the account is removed, a one-time password is generated for the admin to
 * read out, and every existing session is ended: if the phone was stolen
 * rather than lost, whoever has it is signed out too.
 *
 * The temporary password gets the person as far as the enrolment screen and
 * no further, because an account with no passkey cannot reach the app.
 */
export const POST = route<Ctx>(async (_req, { params }) => {
  const actor = await requireRole('admin');
  const { id } = await params;

  const [target] = await db.select().from(users).where(eq(users.userId, id));
  if (!target) throw new ApiError('ไม่พบเจ้าหน้าที่', 404);

  const removed = await db.delete(passkeys).where(eq(passkeys.userId, id)).returning();

  // Long, random, and read out once. Never reused as a lasting credential.
  const temporary = `${crypto.randomBytes(9).toString('base64url')}-${crypto
    .randomBytes(6)
    .toString('base64url')}`;

  await db
    .update(users)
    .set({
      passwordHash: bcrypt.hashSync(temporary, 10),
      sessionVersion: target.sessionVersion + 1,
    })
    .where(eq(users.userId, id));

  await logAction({
    actor,
    action: 'reset_passkeys',
    targetType: 'user',
    targetId: id,
    details: `${target.username}: ลบพาสคีย์ ${removed.length} อัน และออกรหัสผ่านชั่วคราว`,
  });

  return json({
    ok: true,
    removed: removed.length,
    // Returned once, to the admin who asked. Not stored anywhere readable.
    temporary_password: temporary,
  });
});
