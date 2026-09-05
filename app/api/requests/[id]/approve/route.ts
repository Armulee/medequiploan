import { and, eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { borrowers, equipment, requests } from '@/lib/db/schema';
import { ApiError, json, requireAuth, route } from '@/lib/api';
import { displayStatus, issueBorrow } from '@/lib/borrow';
import { logAction } from '@/lib/audit';
import { recordView, requestView } from '@/lib/views';

type Ctx = { params: Promise<{ id: string }> };

export const PUT = route<Ctx>(async (req, { params }) => {
  const user = await requireAuth();
  const { id } = await params;
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;

  const dueDate = body.due_date ? new Date(String(body.due_date)) : null;
  if (dueDate && Number.isNaN(dueDate.getTime())) throw new ApiError('วันครบกำหนดไม่ถูกต้อง');

  // Claim the request first with a conditional update. Two staff approving the
  // same request at once means only one of them flips it out of รอดำเนินการ,
  // so only one borrow is ever issued. The old code checked the status and
  // then wrote, leaving a window where both passed.
  const claimed = await db
    .update(requests)
    .set({ status: 'อนุมัติ', approvedBy: user.user_id })
    .where(and(eq(requests.requestId, id), eq(requests.status, 'รอดำเนินการ')))
    .returning();

  if (claimed.length === 0) {
    const [found] = await db.select().from(requests).where(eq(requests.requestId, id));
    if (!found) throw new ApiError('ไม่พบคำขอ', 404);
    throw new ApiError('คำขอนี้ถูกดำเนินการไปแล้ว', 409);
  }

  const request = claimed[0];

  let record;
  try {
    record = await issueBorrow({
      borrowerId: request.borrowerId,
      equipmentId: request.equipmentId,
      dueDate,
      handledBy: user,
      source: 'request',
    });
  } catch (err) {
    // Out of stock (or any failure): hand the request back to the queue so it
    // isn't stranded in อนุมัติ with no loan behind it.
    await db
      .update(requests)
      .set({ status: 'รอดำเนินการ', approvedBy: null })
      .where(eq(requests.requestId, id));
    throw err;
  }

  const [updated] = await db
    .update(requests)
    .set({ recordId: record.recordId })
    .where(eq(requests.requestId, id))
    .returning();

  await logAction({
    actor: user,
    action: 'approve_request',
    targetType: 'request',
    targetId: id,
    details: `record=${record.recordId}`,
  });

  const [borrower] = await db
    .select()
    .from(borrowers)
    .where(eq(borrowers.borrowerId, request.borrowerId));
  const [item] = await db
    .select()
    .from(equipment)
    .where(eq(equipment.equipmentId, request.equipmentId));
  const borrowerName = borrower ? `${borrower.firstName} ${borrower.lastName}` : null;

  return json({
    request: requestView(updated, borrowerName, item?.name ?? null),
    record: recordView(record, displayStatus(record), borrowerName, item?.name ?? null),
  });
});
