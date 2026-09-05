import { db } from './db';
import { auditLog } from './db/schema';
import type { SessionUser } from './session';

export async function logAction(entry: {
  actor: SessionUser | null;
  action: string;
  targetType: string;
  targetId?: string;
  details?: string;
}) {
  await db.insert(auditLog).values({
    actorUserId: entry.actor ? entry.actor.user_id : 'public',
    actorName: entry.actor ? entry.actor.name : 'ผู้ใช้ทั่วไป (ไม่ login)',
    action: entry.action,
    targetType: entry.targetType,
    targetId: entry.targetId ?? '',
    details: entry.details ?? '',
  });
}


/**
 * Record that someone LOOKED at personal data, not just that they changed it.
 *
 * Everything here was write-only before, which answers "who changed this
 * record?" and not "who read four hundred people's ID numbers on Tuesday
 * night?" — and for a stolen staff account the second question is the one
 * that matters. Bulk export is the shape of that attack, so the reads worth
 * keeping are the ones that return a whole person: their national ID, their
 * address and the link to their ID photograph.
 *
 * Deliberately not awaited by its callers: a read is not worth failing or
 * delaying because the log is having a bad day.
 */
export function logRead(entry: {
  actor: SessionUser;
  targetType: string;
  targetId: string;
  details?: string;
}): void {
  void logAction({
    actor: entry.actor,
    action: 'read_personal_data',
    targetType: entry.targetType,
    targetId: entry.targetId,
    details: entry.details ?? '',
  }).catch((err) => {
    console.error('audit read log failed:', err);
  });
}
