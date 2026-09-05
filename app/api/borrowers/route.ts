import { desc, eq, ilike, or, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { borrowers } from '@/lib/db/schema';
import { ApiError, json, requireAuth, route } from '@/lib/api';
import { encrypt, nationalIdHash } from '@/lib/crypto';
import { isValidThaiNationalId, normaliseEmail, normalisePhone } from '@/lib/validate';
import { CONSENT_VERSION } from '@/lib/consent';
import { logAction } from '@/lib/audit';
import { saveUpload } from '@/lib/storage';
import { borrowerFullView, borrowerListView } from '@/lib/views';

export const GET = route(async (req: Request) => {
  await requireAuth();
  const q = (new URL(req.url).searchParams.get('q') ?? '').trim();

  // A national-id search is matched against the keyed hash, so it no longer
  // requires decrypting every borrower row to filter in memory.
  const rows = q
    ? await db
        .select()
        .from(borrowers)
        .where(
          or(
            ilike(sql`${borrowers.firstName} || ' ' || ${borrowers.lastName}`, `%${q}%`),
            eq(borrowers.nationalIdHash, /^\d{13}$/.test(q) ? nationalIdHash(q) : ''),
            ilike(borrowers.phone, `%${q.replace(/[\s\-().]/g, '')}%`)
          )
        )
        .orderBy(desc(borrowers.registeredAt))
    : await db.select().from(borrowers).orderBy(desc(borrowers.registeredAt));

  return json({ borrowers: rows.map(borrowerListView) });
});

export const POST = route(async (req: Request) => {
  const user = await requireAuth();
  const form = await req.formData();
  const str = (k: string) => String(form.get(k) ?? '').trim();

  const firstName = str('first_name');
  const lastName = str('last_name');
  const nationalId = str('national_id');
  const address = str('address');

  if (!firstName || !lastName || !nationalId || !address) {
    throw new ApiError('กรุณากรอกข้อมูลให้ครบ (ชื่อ, นามสกุล, เลขบัตรประชาชน, ที่อยู่)');
  }
  if (!isValidThaiNationalId(nationalId)) {
    throw new ApiError('เลขบัตรประชาชนไม่ถูกต้อง (ต้องเป็นตัวเลข 13 หลักและผ่านการตรวจสอบ checksum)');
  }

  const phone = normalisePhone(str('phone'));
  if (!phone) {
    throw new ApiError('เบอร์โทรศัพท์ไม่ถูกต้อง กรุณากรอกเบอร์ที่ติดต่อได้ (เช่น 0812345678)');
  }

  const email = normaliseEmail(str('email'));
  if (email === null) throw new ApiError('อีเมลไม่ถูกต้อง กรุณาตรวจสอบอีกครั้ง');

  // The staff member confirms the person in front of them was read the notice
  // and agreed. Same lawful basis as the public form, same record kept.
  if (str('consent') !== 'true') {
    throw new ApiError('กรุณายืนยันว่าได้แจ้งประกาศความเป็นส่วนตัว (PDPA) และผู้ยืมให้ความยินยอมแล้ว');
  }

  // Optional, and the same photo the public form takes: what helps staff
  // decide is a picture of the condition, not a copy of an ID card they are
  // holding in their hand anyway. One less copy of an ID document stored.
  const photo = form.get('illness_photo');
  const hasPhoto = photo instanceof File && photo.size > 0;

  const hash = nationalIdHash(nationalId);
  const [existing] = await db.select().from(borrowers).where(eq(borrowers.nationalIdHash, hash));
  if (existing) {
    throw new ApiError(`เลขบัตรประชาชนนี้ลงทะเบียนไว้แล้ว (รหัส ${existing.borrowerId})`, 409);
  }

  const illnessPhotoId = hasPhoto
    ? await saveUpload('illness_photos', photo).catch((e) => {
        throw new ApiError(e instanceof Error ? e.message : 'อัปโหลดรูปไม่สำเร็จ');
      })
    : null;

  const [created] = await db
    .insert(borrowers)
    .values({
      firstName,
      lastName,
      nationalIdEnc: encrypt(nationalId),
      nationalIdHash: hash,
      address,
      phone,
      lineId: str('line_id'),
      email,
      consentAcceptedAt: new Date(),
      consentVersion: CONSENT_VERSION,
      illnessDescription: str('illness_description'),
      illnessPhotoId,
      // Registered face to face rather than through the public form. It no
      // longer means an ID card was photographed — nothing asks for one.
      verified: true,
      selfRegistered: false,
      registeredBy: user.user_id,
    })
    .returning();

  await logAction({
    actor: user,
    action: 'accept_consent',
    targetType: 'borrower',
    targetId: created.borrowerId,
    details: `PDPA v${CONSENT_VERSION} (เจ้าหน้าที่ยืนยันแทน)`,
  });
  await logAction({
    actor: user,
    action: 'register_borrower',
    targetType: 'borrower',
    targetId: created.borrowerId,
  });

  return json({ borrower: borrowerFullView(created) }, 201);
});
