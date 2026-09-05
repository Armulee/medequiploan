import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { borrowers, equipment, records } from '@/lib/db/schema';
import { ApiError, json, requireAuth, route } from '@/lib/api';
import { displayStatus } from '@/lib/borrow';
import { recordView } from '@/lib/views';

type Ctx = { params: Promise<{ id: string }> };

/** One loan, so /staff/records/[id] survives a refresh and can be linked to. */
export const GET = route<Ctx>(async (_req, { params }) => {
  await requireAuth();
  const { id } = await params;

  const [row] = await db
    .select({
      record: records,
      borrowerFirst: borrowers.firstName,
      borrowerLast: borrowers.lastName,
      equipmentName: equipment.name,
    })
    .from(records)
    .leftJoin(borrowers, eq(records.borrowerId, borrowers.borrowerId))
    .leftJoin(equipment, eq(records.equipmentId, equipment.equipmentId))
    .where(eq(records.recordId, id));

  if (!row) throw new ApiError('ไม่พบรายการยืม', 404);

  return json({
    record: recordView(
      row.record,
      displayStatus(row.record),
      row.borrowerFirst ? `${row.borrowerFirst} ${row.borrowerLast}` : null,
      row.equipmentName
    ),
  });
});
