import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { borrowers } from '@/lib/db/schema';
import { ApiError, json, requireAuth, route } from '@/lib/api';
import { deleteUpload, saveUpload } from '@/lib/storage';
import { borrowerFullView } from '@/lib/views';

type Ctx = { params: Promise<{ id: string }> };

export const POST = route<Ctx>(async (req, { params }) => {
  await requireAuth();
  const { id } = await params;

  const [existing] = await db.select().from(borrowers).where(eq(borrowers.borrowerId, id));
  if (!existing) throw new ApiError('ไม่พบข้อมูลผู้ยืม', 404);

  const file = (await req.formData()).get('illness_photo');
  if (!(file instanceof File) || file.size === 0) throw new ApiError('ไม่พบไฟล์รูปภาพ');

  const photoId = await saveUpload('illness_photos', file).catch((e) => {
    throw new ApiError(e instanceof Error ? e.message : 'อัปโหลดรูปไม่สำเร็จ');
  });

  const [updated] = await db
    .update(borrowers)
    .set({ illnessPhotoId: photoId })
    .where(eq(borrowers.borrowerId, id))
    .returning();

  // Drop the superseded photo so old health images don't linger in storage.
  if (existing.illnessPhotoId) await deleteUpload(existing.illnessPhotoId);

  return json({ borrower: borrowerFullView(updated) });
});
