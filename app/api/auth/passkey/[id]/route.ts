import { and, eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { passkeys } from '@/lib/db/schema';
import { ApiError, json, requireAuth, route } from '@/lib/api';
import { logAction } from '@/lib/audit';

type Ctx = { params: Promise<{ id: string }> };

/**
 * Remove one of your own passkeys — a device sold, lost, or replaced.
 *
 * Scoped to the caller's own account by the WHERE clause, not by trusting the
 * id in the path, so this cannot be pointed at somebody else's device. The
 * last one cannot be removed here: an account with no passkey and no way back
 * in is a support call, and the admin reset is the supported route.
 */
export const DELETE = route<Ctx>(async (_req, { params }) => {
  const user = await requireAuth();
  const { id } = await params;

  const mine = await db.select().from(passkeys).where(eq(passkeys.userId, user.user_id));
  if (mine.length <= 1) {
    throw new ApiError(
      'ลบพาสคีย์อันสุดท้ายไม่ได้ — เพิ่มอุปกรณ์ใหม่ก่อน หรือให้แอดมินรีเซ็ตพาสคีย์ให้',
      409
    );
  }

  const [removed] = await db
    .delete(passkeys)
    .where(and(eq(passkeys.passkeyId, id), eq(passkeys.userId, user.user_id)))
    .returning();
  if (!removed) throw new ApiError('ไม่พบพาสคีย์นี้', 404);

  await logAction({
    actor: user,
    action: 'delete_passkey',
    targetType: 'user',
    targetId: user.user_id,
    details: removed.label,
  });

  return json({ ok: true });
});
