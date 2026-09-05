import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { borrowers, equipment, requests } from '@/lib/db/schema';
import { ApiError, json, requireAuth, route } from '@/lib/api';
import { fileUrl } from '@/lib/views';

type Ctx = { params: Promise<{ id: string }> };

/** One request, shaped like a row of GET /api/requests plus what it submitted. */
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
      borrowerEmail: borrowers.email,
      borrowerAddress: borrowers.address,
      borrowerSelfRegistered: borrowers.selfRegistered,
      equipmentName: equipment.name,
    })
    .from(requests)
    .leftJoin(borrowers, eq(requests.borrowerId, borrowers.borrowerId))
    .leftJoin(equipment, eq(requests.equipmentId, equipment.equipmentId))
    .where(eq(requests.requestId, id));

  if (!r) throw new ApiError('ไม่พบคำขอ', 404);

  const onFile = {
    name: r.borrowerFirst ? `${r.borrowerFirst} ${r.borrowerLast}` : '',
    phone: r.borrowerPhone ?? '',
    line_id: r.borrowerLineId ?? '',
    email: r.borrowerEmail ?? '',
    address: r.borrowerAddress ?? '',
  };
  const submitted = {
    name: r.request.contactName,
    phone: r.request.contactPhone,
    line_id: r.request.contactLineId,
    email: r.request.contactEmail,
    address: r.request.contactAddress,
  };

  // Which fields this submission disagrees with. An empty submitted field is
  // not a disagreement — the form does not require LINE or email — but a
  // different non-empty one is exactly what a staff member must look at
  // before ringing the number back.
  const differs = (Object.keys(submitted) as Array<keyof typeof submitted>).filter(
    (k) => submitted[k] !== '' && onFile[k] !== '' && submitted[k].trim() !== onFile[k].trim()
  );

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
      borrower_name: onFile.name || r.request.borrowerId,
      borrower_phone: onFile.phone,
      borrower_line_id: onFile.line_id,
      equipment_name: r.equipmentName ?? r.request.equipmentId,
      // Attached to THIS request, which is the copy staff check.
      id_card_photo_url: fileUrl(r.request.idCardPhotoId),
      illness_photo_url: fileUrl(r.request.illnessPhotoId),
      consent_accepted_at: r.request.consentAcceptedAt,
      consent_version: r.request.consentVersion,
    },
    submitted,
    on_file: onFile,
    differs,
    /** True when the borrower row was created by this same public form. */
    borrower_self_registered: Boolean(r.borrowerSelfRegistered),
  });
});
