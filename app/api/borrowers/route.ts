import { desc, eq, ilike, or, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { borrowers } from '@/lib/db/schema';
import { ApiError, json, requireAuth, route } from '@/lib/api';
import { encrypt, nationalIdHash } from '@/lib/crypto';
import { isValidThaiNationalId } from '@/lib/validate';
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
            eq(borrowers.nationalIdHash, /^\d{13}$/.test(q) ? nationalIdHash(q) : '')
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

  const photo = form.get('id_card_photo');
  if (!(photo instanceof File) || photo.size === 0) {
    throw new ApiError('กรุณาแนบรูปบัตรประชาชนเพื่อยืนยันตัวตน');
  }

  const hash = nationalIdHash(nationalId);
  const [existing] = await db.select().from(borrowers).where(eq(borrowers.nationalIdHash, hash));
  if (existing) {
    throw new ApiError(`เลขบัตรประชาชนนี้ลงทะเบียนไว้แล้ว (รหัส ${existing.borrowerId})`, 409);
  }

  const idCardPhotoId = await saveUpload('id_cards', photo).catch((e) => {
    throw new ApiError(e instanceof Error ? e.message : 'อัปโหลดรูปไม่สำเร็จ');
  });

  const [created] = await db
    .insert(borrowers)
    .values({
      firstName,
      lastName,
      nationalIdEnc: encrypt(nationalId),
      nationalIdHash: hash,
      address,
      illnessDescription: str('illness_description'),
      idCardPhotoId,
      verified: true,
      selfRegistered: false,
      registeredBy: user.user_id,
    })
    .returning();

  await logAction({
    actor: user,
    action: 'register_borrower',
    targetType: 'borrower',
    targetId: created.borrowerId,
  });

  return json({ borrower: borrowerFullView(created) }, 201);
});
