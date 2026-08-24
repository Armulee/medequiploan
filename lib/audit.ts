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
