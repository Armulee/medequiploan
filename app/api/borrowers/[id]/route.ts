import { and, eq, isNotNull, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { borrowers, records } from '@/lib/db/schema';
import { ApiError, json, requireAuth, route } from '@/lib/api';
import { logRead } from '@/lib/audit';
import { borrowerFullView } from '@/lib/views';

type Ctx = { params: Promise<{ id: string }> };

export const GET = route<Ctx>(async (_req, { params }) => {
  const actor = await requireAuth();
  const { id } = await params;
  const [found] = await db.select().from(borrowers).where(eq(borrowers.borrowerId, id));
  if (!found) throw new ApiError('ไม่พบข้อมูลผู้ยืม', 404);

  // This response carries the decrypted national ID, the address and a link
  // to the ID photograph. Reading it is the thing worth being able to review
  // afterwards, so it is logged like a change.
  logRead({ actor, targetType: 'borrower', targetId: id });

  // The on-time rate is counted in SQL over every loan this person has closed,
  // not over the rows the page happens to have scrolled to. Only loans that
  // had a due date can be judged, so the denominator is those.
  const [rate] = await db
    .select({
      judged: sql<number>`count(*)::int`,
      onTime: sql<number>`count(*) filter (where ${records.returnDate} <= ${records.dueDate})::int`,
    })
    .from(records)
    .where(
      and(
        eq(records.borrowerId, id),
        isNotNull(records.returnDate),
        isNotNull(records.dueDate)
      )
    );

  return json({
    borrower: borrowerFullView(found),
    on_time: { judged: Number(rate?.judged ?? 0), on_time: Number(rate?.onTime ?? 0) },
  });
});
