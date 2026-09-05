import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { borrowers, requests } from '@/lib/db/schema';
import { ApiError, json, requireAuth, route } from '@/lib/api';
import { logAction } from '@/lib/audit';
import { deleteUpload } from '@/lib/storage';
import { borrowerFullView } from '@/lib/views';

type Ctx = { params: Promise<{ id: string }> };

/**
 * Copy what a public request submitted onto the borrower's record — the step
 * the public form used to take by itself.
 *
 * It is a staff action now, and an audited one, because the form proves only
 * that the sender knew a national ID. A member of staff who has read the card
 * photograph attached to the request, and compared it with the record, is the
 * one who can say the new phone number belongs to the same person.
 */
export const POST = route<Ctx>(async (_req, { params }) => {
  const actor = await requireAuth();
  const { id } = await params;

  const [request] = await db.select().from(requests).where(eq(requests.requestId, id));
  if (!request) throw new ApiError('ไม่พบคำขอ', 404);

  const [borrower] = await db
    .select()
    .from(borrowers)
    .where(eq(borrowers.borrowerId, request.borrowerId));
  if (!borrower) throw new ApiError('ไม่พบข้อมูลผู้ยืม', 404);

  const changed: string[] = [];
  const patch: Partial<typeof borrowers.$inferInsert> = {};

  // Only non-empty submitted values, and only where they actually differ.
  const move = <K extends 'phone' | 'lineId' | 'email' | 'address'>(
    key: K,
    value: string,
    label: string
  ) => {
    if (value && value.trim() !== (borrower[key] ?? '').trim()) {
      patch[key] = value;
      changed.push(label);
    }
  };
  move('phone', request.contactPhone, 'เบอร์โทร');
  move('lineId', request.contactLineId, 'LINE');
  move('email', request.contactEmail, 'อีเมล');
  move('address', request.contactAddress, 'ที่อยู่');

  const oldCard = borrower.idCardPhotoId;
  if (request.idCardPhotoId && request.idCardPhotoId !== oldCard) {
    patch.idCardPhotoId = request.idCardPhotoId;
    changed.push('รูปบัตรประชาชน');
  }
  if (request.illnessPhotoId && request.illnessPhotoId !== borrower.illnessPhotoId) {
    patch.illnessPhotoId = request.illnessPhotoId;
    changed.push('รูปอาการป่วย');
  }
  // The consent that came with the request is the newest one this person gave.
  if (request.consentAcceptedAt) {
    patch.consentAcceptedAt = request.consentAcceptedAt;
    patch.consentVersion = request.consentVersion;
  }

  if (changed.length === 0) throw new ApiError('ข้อมูลในคำขอตรงกับที่มีอยู่แล้ว ไม่มีอะไรต้องอัปเดต');

  const [updated] = await db
    .update(borrowers)
    .set(patch)
    .where(eq(borrowers.borrowerId, borrower.borrowerId))
    .returning();

  await logAction({
    actor,
    action: 'adopt_request_contact',
    targetType: 'borrower',
    targetId: borrower.borrowerId,
    details: `จากคำขอ ${id}: ${changed.join(', ')}`,
  });

  // The request keeps its own copy of the card, so the superseded one on the
  // borrower is only dropped when nothing else points at it.
  if (patch.idCardPhotoId && oldCard && oldCard !== request.idCardPhotoId) {
    const stillUsed = await db
      .select({ id: requests.requestId })
      .from(requests)
      .where(eq(requests.idCardPhotoId, oldCard))
      .limit(1);
    if (stillUsed.length === 0) await deleteUpload(oldCard);
  }

  return json({ borrower: borrowerFullView(updated), changed });
});
