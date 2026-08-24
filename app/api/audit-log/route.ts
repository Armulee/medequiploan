import { and, desc, eq, type SQL } from 'drizzle-orm';
import { db } from '@/lib/db';
import { auditLog } from '@/lib/db/schema';
import { json, requireAuth, route } from '@/lib/api';

export const GET = route(async (req: Request) => {
  await requireAuth();
  const sp = new URL(req.url).searchParams;

  const filters: SQL[] = [];
  const targetType = sp.get('target_type');
  const targetId = sp.get('target_id');
  const actorUserId = sp.get('actor_user_id');
  if (targetType) filters.push(eq(auditLog.targetType, targetType));
  if (targetId) filters.push(eq(auditLog.targetId, targetId));
  if (actorUserId) filters.push(eq(auditLog.actorUserId, actorUserId));

  // Filtering and limiting happen in SQL rather than after loading every row,
  // so the log staying around for years doesn't slow the page down.
  const parsedLimit = Number.parseInt(sp.get('limit') ?? '', 10);
  const limit = Number.isFinite(parsedLimit) && parsedLimit > 0 ? Math.min(parsedLimit, 500) : 200;

  const rows = await db
    .select()
    .from(auditLog)
    .where(filters.length ? and(...filters) : undefined)
    .orderBy(desc(auditLog.at))
    .limit(limit);

  return json({
    audit_log: rows.map((l) => ({
      log_id: l.logId,
      actor_user_id: l.actorUserId,
      actor_name: l.actorName,
      action: l.action,
      target_type: l.targetType,
      target_id: l.targetId,
      details: l.details,
      at: l.at,
    })),
  });
});
