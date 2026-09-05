import { and, desc, eq, sql, type SQL } from 'drizzle-orm';
import { db } from '@/lib/db';
import { auditLog } from '@/lib/db/schema';
import { json, pageParams, requireRole, route } from '@/lib/api';

export const GET = route(async (req: Request) => {
  // The log names who did what to whose record; that is an oversight tool,
  // not something every staff member needs to read.
  await requireRole('admin');
  const sp = new URL(req.url).searchParams;

  const filters: SQL[] = [];
  const targetType = sp.get('target_type');
  const targetId = sp.get('target_id');
  const actorUserId = sp.get('actor_user_id');
  if (targetType) filters.push(eq(auditLog.targetType, targetType));
  if (targetId) filters.push(eq(auditLog.targetId, targetId));
  if (actorUserId) filters.push(eq(auditLog.actorUserId, actorUserId));

  // Filtering and paging happen in SQL rather than after loading every row,
  // so the log staying around for years doesn't slow the page down.
  const where = filters.length ? and(...filters) : undefined;
  const page = pageParams(sp, 500) ?? { limit: 200, offset: 0 };

  const rows = await db
    .select()
    .from(auditLog)
    .where(where)
    // The id breaks ties: rows written by one statement share `at` to the
    // microsecond, and LIMIT/OFFSET over an ambiguous sort can hand the same
    // row to two pages and drop another. Which it did, visibly.
    .orderBy(desc(auditLog.at), desc(auditLog.logId))
    .limit(page.limit)
    .offset(page.offset);

  const [counted] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(auditLog)
    .where(where);

  return json({
    total: Number(counted?.n ?? rows.length),
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
