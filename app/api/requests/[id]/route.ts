import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { borrowers, equipment, requests } from '@/lib/db/schema';
import { ApiError, json, requireAuth, route } from '@/lib/api';

type Ctx = { params: Promise<{ id: string }> };

/** One request, shaped exactly like a row of GET /api/requests. */
export const GET = route<Ctx>(async (_req, { params }) => {
  await requireAuth();
  const { id } = await params;

  const [r] = await db
    .select({
      request: requests,
      borrowerFirst: borrowers.firstName,
      borrowerLast: borrowers.lastName,
      borrowerPhone: borrowers.phone,
      borrowerLineId: borrowers.lineId,
      equipmentName: equipment.name,
    })
    .from(requests)
    .leftJoin(borrowers, eq(requests.borrowerId, borrowers.borrowerId))
    .leftJoin(equipment, eq(requests.equipmentId, equipment.equipmentId))
    .where(eq(requests.requestId, id));

  if (!r) throw new ApiError('ไม่พบคำขอ', 404);

  return json({
    request: {
      request_id: r.request.requestId,
      borrower_id: r.request.borrowerId,
      equipment_id: r.request.equipmentId,
      requested_at: r.request.requestedAt,
      status: r.request.status,
      approved_by: r.request.approvedBy,
      record_id: r.request.recordId,
      note: r.request.note,
      borrower_name: r.borrowerFirst
        ? `${r.borrowerFirst} ${r.borrowerLast}`
        : r.request.borrowerId,
      borrower_phone: r.borrowerPhone ?? '',
      borrower_line_id: r.borrowerLineId ?? '',
      equipment_name: r.equipmentName ?? r.request.equipmentId,
    },
  });
});
