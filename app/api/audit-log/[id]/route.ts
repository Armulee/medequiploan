import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { auditLog } from '@/lib/db/schema';
import { ApiError, json, requireRole, route } from '@/lib/api';

type Ctx = { params: Promise<{ id: string }> };

/** Admin only, exactly like the list it comes from. */
export const GET = route<Ctx>(async (_req, { params }) => {
  await requireRole('admin');
  const { id } = await params;

  const [row] = await db.select().from(auditLog).where(eq(auditLog.logId, id));
  if (!row) throw new ApiError('ไม่พบรายการในประวัติ', 404);

  return json({
    entry: {
      log_id: row.logId,
      actor_user_id: row.actorUserId,
      actor_name: row.actorName,
      action: row.action,
      target_type: row.targetType,
      target_id: row.targetId,
      details: row.details,
      at: row.at,
    },
  });
});
