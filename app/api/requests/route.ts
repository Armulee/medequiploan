import { desc, eq, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { borrowers, equipment, requests } from '@/lib/db/schema';
import { ApiError, json, requiredPage, requireAuth, route } from '@/lib/api';
import { encrypt, nationalIdHash } from '@/lib/crypto';
import { isValidThaiNationalId, normaliseEmail, normalisePhone } from '@/lib/validate';
import { CONSENT_VERSION } from '@/lib/consent';
import { logAction } from '@/lib/audit';
import { saveUpload } from '@/lib/storage';
import { RULES, clientIp, hit, sweepExpired, tooManyRequests } from '@/lib/rate-limit';
import { requireHuman } from '@/lib/turnstile';

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

  // Before anything is validated or written: a bot that cannot solve the
  // challenge should not get as far as costing a borrower row or a photo.
  await requireHuman(form.get('turnstile_token'), ip);

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

  const email = normaliseEmail(str('email'));
  if (email === null) throw new ApiError('อีเมลไม่ถูกต้อง กรุณาตรวจสอบอีกครั้ง');

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

  // Required: a staff member reads the card before approving, so a request
  // without one cannot be decided and should not be accepted. Checked on the
  // server, not only by the form, like every other rule here.
  const idCard = form.get('id_card_photo');
  if (!(idCard instanceof File) || idCard.size === 0) {
    throw new ApiError('กรุณาแนบรูปบัตรประชาชน เจ้าหน้าที่ต้องใช้ตรวจสอบก่อนอนุมัติ');
  }
  const idCardId = await saveUpload('id_cards', idCard).catch((e) => {
    throw new ApiError(e instanceof Error ? e.message : 'อัปโหลดรูปบัตรประชาชนไม่สำเร็จ');
  });

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
    // Deliberately NOT updated. This form is unauthenticated and the only
    // thing it proves is that the sender knows a national ID, which is not a
    // secret in Thailand. Writing the submitted phone number and ID
    // photograph over the record would let anyone holding someone's ID number
    // redirect that person's callbacks to themselves, in their name.
    //
    // Everything submitted is kept on the request instead (below), where a
    // staff member sees it beside the record and decides.
    borrowerId = existing.borrowerId;
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
        email,
        consentAcceptedAt: new Date(),
        consentVersion: CONSENT_VERSION,
        idCardPhotoId: idCardId,
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
    .values({
      borrowerId,
      equipmentId,
      note: illnessDescription,
      // What this submission said, and the consent that came with it.
      contactName: `${firstName} ${lastName}`,
      contactPhone: phone,
      contactLineId: lineId,
      contactEmail: email,
      contactAddress: address,
      idCardPhotoId: idCardId,
      illnessPhotoId: photoId,
      consentAcceptedAt: new Date(),
      consentVersion: CONSENT_VERSION,
    })
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
  const sp = new URL(req.url).searchParams;
  const status = sp.get('status');
  // Filtered in SQL rather than over the mapped array, so a page of twenty is
  // twenty matching requests and the count beside them is the whole queue.
  const where = status ? eq(requests.status, status) : undefined;

  const page = requiredPage(sp);
  const query = db
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
    .where(where)
    .orderBy(desc(requests.requestedAt), desc(requests.requestId))
    .$dynamic();

  const rows = await query.limit(page.limit).offset(page.offset);

  const list = rows.map((r) => ({
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

  const total = Number(
    (await db.select({ n: sql<number>`count(*)::int` }).from(requests).where(where))[0]?.n ?? 0
  );

  return json({ requests: list, total });
});
