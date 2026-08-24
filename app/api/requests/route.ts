import { desc, eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { borrowers, equipment, requests } from '@/lib/db/schema';
import { ApiError, json, requireAuth, route } from '@/lib/api';
import { encrypt, nationalIdHash } from '@/lib/crypto';
import { isValidThaiNationalId } from '@/lib/validate';
import { logAction } from '@/lib/audit';
import { saveUpload } from '@/lib/storage';

// PUBLIC: submit a borrow request without logging in (spec 4.3).
export const POST = route(async (req: Request) => {
  const form = await req.formData();
  const str = (k: string) => String(form.get(k) ?? '').trim();

  const firstName = str('first_name');
  const lastName = str('last_name');
  const nationalId = str('national_id');
  const address = str('address');
  const equipmentId = str('equipment_id');
  const illnessDescription = str('illness_description');

  if (!firstName || !lastName || !nationalId || !address || !equipmentId) {
    throw new ApiError('กรุณากรอกข้อมูลให้ครบ (ชื่อ, นามสกุล, เลขบัตรประชาชน, ที่อยู่, อุปกรณ์ที่ต้องการ)');
  }
  if (!isValidThaiNationalId(nationalId)) {
    throw new ApiError('เลขบัตรประชาชนไม่ถูกต้อง (ต้องเป็นตัวเลข 13 หลัก)');
  }

  const [item] = await db.select().from(equipment).where(eq(equipment.equipmentId, equipmentId));
  if (!item) throw new ApiError('ไม่พบอุปกรณ์ที่เลือก', 404);

  const photo = form.get('illness_photo');
  const photoId =
    photo instanceof File && photo.size > 0
      ? await saveUpload('illness_photos', photo).catch((e) => {
          throw new ApiError(e instanceof Error ? e.message : 'อัปโหลดรูปไม่สำเร็จ');
        })
      : null;

  const hash = nationalIdHash(nationalId);
  const [existing] = await db.select().from(borrowers).where(eq(borrowers.nationalIdHash, hash));

  let borrowerId: string;
  if (existing) {
    borrowerId = existing.borrowerId;
    if (photoId) {
      await db
        .update(borrowers)
        .set({ illnessPhotoId: photoId })
        .where(eq(borrowers.borrowerId, borrowerId));
    }
  } else {
    const [created] = await db
      .insert(borrowers)
      .values({
        firstName,
        lastName,
        nationalIdEnc: encrypt(nationalId),
        nationalIdHash: hash,
        address,
        illnessPhotoId: photoId,
        illnessDescription,
        verified: false,
        selfRegistered: true,
      })
      .returning();
    borrowerId = created.borrowerId;
    await logAction({
      actor: null,
      action: 'self_register_borrower',
      targetType: 'borrower',
      targetId: borrowerId,
    });
  }

  const [created] = await db
    .insert(requests)
    .values({ borrowerId, equipmentId, note: illnessDescription })
    .returning();

  await logAction({
    actor: null,
    action: 'submit_request',
    targetType: 'request',
    targetId: created.requestId,
  });

  // Deliberately minimal: this endpoint is public, so it must not echo back
  // anything about the borrower beyond the ticket number they just created.
  return json({ request: { request_id: created.requestId, status: created.status } }, 201);
});

// STAFF: the approval queue.
export const GET = route(async (req: Request) => {
  await requireAuth();
  const status = new URL(req.url).searchParams.get('status');

  const rows = await db
    .select({
      request: requests,
      borrowerFirst: borrowers.firstName,
      borrowerLast: borrowers.lastName,
      equipmentName: equipment.name,
    })
    .from(requests)
    .leftJoin(borrowers, eq(requests.borrowerId, borrowers.borrowerId))
    .leftJoin(equipment, eq(requests.equipmentId, equipment.equipmentId))
    .orderBy(desc(requests.requestedAt));

  let list = rows.map((r) => ({
    request_id: r.request.requestId,
    borrower_id: r.request.borrowerId,
    equipment_id: r.request.equipmentId,
    requested_at: r.request.requestedAt,
    status: r.request.status,
    approved_by: r.request.approvedBy,
    record_id: r.request.recordId,
    note: r.request.note,
    borrower_name: r.borrowerFirst ? `${r.borrowerFirst} ${r.borrowerLast}` : r.request.borrowerId,
    equipment_name: r.equipmentName ?? r.request.equipmentId,
  }));

  if (status) list = list.filter((r) => r.status === status);
  return json({ requests: list });
});
