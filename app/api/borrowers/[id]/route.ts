import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { borrowers } from '@/lib/db/schema';
import { ApiError, json, requireAuth, route } from '@/lib/api';
import { borrowerFullView } from '@/lib/views';

type Ctx = { params: Promise<{ id: string }> };

export const GET = route<Ctx>(async (_req, { params }) => {
  await requireAuth();
  const { id } = await params;
  const [found] = await db.select().from(borrowers).where(eq(borrowers.borrowerId, id));
  if (!found) throw new ApiError('ไม่พบข้อมูลผู้ยืม', 404);
  return json({ borrower: borrowerFullView(found) });
});
