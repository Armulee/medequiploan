import { and, eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { borrowers, equipment, requests } from '@/lib/db/schema';
import { ApiError, json, requireAuth, route } from '@/lib/api';
import { logAction } from '@/lib/audit';
import { requestView } from '@/lib/views';

type Ctx = { params: Promise<{ id: string }> };

export const PUT = route<Ctx>(async (req, { params }) => {
  const user = await requireAuth();
  const { id } = await params;
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const reason = String(body.reason ?? '').trim();

  const updated = await db
    .update(requests)
    .set({ status: 'ปฏิเสธ', approvedBy: user.user_id, ...(reason ? { note: reason } : {}) })
    .where(and(eq(requests.requestId, id), eq(requests.status, 'รอดำเนินการ')))
    .returning();

  if (updated.length === 0) {
    const [found] = await db.select().from(requests).where(eq(requests.requestId, id));
    if (!found) throw new ApiError('ไม่พบคำขอ', 404);
    throw new ApiError('คำขอนี้ถูกดำเนินการไปแล้ว', 409);
  }

  await logAction({
    actor: user,
    action: 'reject_request',
    targetType: 'request',
    targetId: id,
    details: reason,
  });

  const [borrower] = await db
    .select()
    .from(borrowers)
    .where(eq(borrowers.borrowerId, updated[0].borrowerId));
  const [item] = await db
    .select()
    .from(equipment)
    .where(eq(equipment.equipmentId, updated[0].equipmentId));

  return json({
    request: requestView(
      updated[0],
      borrower ? `${borrower.firstName} ${borrower.lastName}` : null,
      item?.name ?? null
    ),
  });
});
