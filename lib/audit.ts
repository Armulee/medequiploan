import { db } from './db';
import { auditLog } from './db/schema';
import type { SessionUser } from './session';

/**
 * The actor for something the system did on its own — a scheduled job, or the
 * same job run from a terminal. `null` already means "a member of the public
 * did this on an open form", and a weekly cron deleting records is not that;
 * a log that calls it that is worse than one that says nothing.
 */
export const SYSTEM_ACTOR: SessionUser = {
  user_id: 'system',
  username: 'system',
  // For the log only — nothing authorises against this. It says 'staff'
  // rather than 'admin' so that if it ever did leak into a permission check
  // by mistake, it would grant the least it possibly could.
  role: 'staff',
  name: 'ระบบอัตโนมัติ',
};

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
