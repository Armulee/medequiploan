import { desc, eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { borrowers, equipment, requests } from '@/lib/db/schema';
import { ApiError, json, requireAuth, route } from '@/lib/api';
import { encrypt, nationalIdHash } from '@/lib/crypto';
import { isValidThaiNationalId, normalisePhone } from '@/lib/validate';
import { CONSENT_VERSION } from '@/lib/consent';
import { logAction } from '@/lib/audit';
import { saveUpload } from '@/lib/storage';
import { RULES, clientIp, hit, sweepExpired, tooManyRequests } from '@/lib/rate-limit';

// PUBLIC: submit a borrow request without logging in (spec 4.3).
export const POST = route(async (req: Request) => {
  void sweepExpired();

  // This endpoint needs no login and both creates a borrower row and accepts a
  // photo upload, so unchecked it is a way to fill the database and burn
  // through the blob storage quota. Checked before the body is read so a
  // flood costs nothing.
  const ip = clientIp(req);
  const limit = await hit(`request:ip:${ip}`, RULES.publicRequestPerIp);
  if (!limit.allowed) throw tooManyRequests(limit.retryAfterSeconds);

  const form = await req.formData();
  const str = (k: string) => String(form.get(k) ?? '').trim();

  const firstName = str('first_name');
  const lastName = str('last_name');
  const nationalId = str('national_id');
  const address = str('address');
  const equipmentId = str('equipment_id');
  const illnessDescription = str('illness_description');
  const lineId = str('line_id');

  if (!firstName || !lastName || !nationalId || !address || !equipmentId) {
    throw new ApiError('กรุณากรอกข้อมูลให้ครบ (ชื่อ, นามสกุล, เลขบัตรประชาชน, ที่อยู่, อุปกรณ์ที่ต้องการ)');
  }

  const phone = normalisePhone(str('phone'));
  if (!phone) {
    throw new ApiError('เบอร์โทรศัพท์ไม่ถูกต้อง กรุณากรอกเบอร์ที่ติดต่อได้ (เช่น 0812345678)');
  }

  // Enforced on the server, not just by the checkbox: consent is the lawful
  // basis for holding any of this, so a request that skips it must be refused
  // however it was sent.
  if (str('consent') !== 'true') {
    throw new ApiError('กรุณาอ่านและยอมรับประกาศความเป็นส่วนตัว (PDPA) ก่อนส่งคำขอ');
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
    // Refresh the details they just gave us — a phone number that changed
    // since last time matters, and re-consenting renews the record.
    await db
      .update(borrowers)
      .set({
        phone,
        lineId: lineId || existing.lineId,
        consentAcceptedAt: new Date(),
        consentVersion: CONSENT_VERSION,
        ...(photoId ? { illnessPhotoId: photoId } : {}),
      })
      .where(eq(borrowers.borrowerId, borrowerId));
  } else {
    const [created] = await db
      .insert(borrowers)
      .values({
        firstName,
        lastName,
        nationalIdEnc: encrypt(nationalId),
        nationalIdHash: hash,
        address,
        phone,
        lineId,
        consentAcceptedAt: new Date(),
        consentVersion: CONSENT_VERSION,
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
    action: 'accept_consent',
    targetType: 'borrower',
    targetId: borrowerId,
    details: `PDPA v${CONSENT_VERSION}`,
  });
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
      borrowerPhone: borrowers.phone,
      borrowerLineId: borrowers.lineId,
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
    borrower_phone: r.borrowerPhone ?? '',
    borrower_line_id: r.borrowerLineId ?? '',
    equipment_name: r.equipmentName ?? r.request.equipmentId,
  }));

  if (status) list = list.filter((r) => r.status === status);
  return json({ requests: list });
});
