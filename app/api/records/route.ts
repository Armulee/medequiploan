import { desc, eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { borrowers, equipment, records } from '@/lib/db/schema';
import { ApiError, json, requireAuth, route } from '@/lib/api';
import { displayStatus, issueBorrow } from '@/lib/borrow';
import { recordView } from '@/lib/views';

export const GET = route(async (req: Request) => {
  await requireAuth();
  const sp = new URL(req.url).searchParams;

  const rows = await db
    .select({
      record: records,
      borrowerFirst: borrowers.firstName,
      borrowerLast: borrowers.lastName,
      equipmentName: equipment.name,
    })
    .from(records)
    .leftJoin(borrowers, eq(records.borrowerId, borrowers.borrowerId))
    .leftJoin(equipment, eq(records.equipmentId, equipment.equipmentId))
    .orderBy(desc(records.borrowDate));

  let list = rows.map((r) =>
    recordView(
      r.record,
      displayStatus(r.record),
      r.borrowerFirst ? `${r.borrowerFirst} ${r.borrowerLast}` : null,
      r.equipmentName
    )
  );

  const borrowerId = sp.get('borrower_id');
  const equipmentId = sp.get('equipment_id');
  const status = sp.get('status');
  if (borrowerId) list = list.filter((r) => r.borrower_id === borrowerId);
  if (equipmentId) list = list.filter((r) => r.equipment_id === equipmentId);
  if (status) list = list.filter((r) => r.status === status);

  return json({ records: list });
});

export const POST = route(async (req: Request) => {
  const user = await requireAuth();
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;

  const borrowerId = String(body.borrower_id ?? '').trim();
  const equipmentId = String(body.equipment_id ?? '').trim();
  if (!borrowerId || !equipmentId) throw new ApiError('กรุณาเลือกผู้ยืมและอุปกรณ์');

  const [borrower] = await db.select().from(borrowers).where(eq(borrowers.borrowerId, borrowerId));
  if (!borrower) throw new ApiError('ไม่พบข้อมูลผู้ยืม', 404);

  const dueDate = body.due_date ? new Date(String(body.due_date)) : null;
  if (dueDate && Number.isNaN(dueDate.getTime())) throw new ApiError('วันครบกำหนดไม่ถูกต้อง');

  const record = await issueBorrow({
    borrowerId,
    equipmentId,
    dueDate,
    handledBy: user,
    source: 'direct',
  });

  const [item] = await db.select().from(equipment).where(eq(equipment.equipmentId, equipmentId));
  return json(
    {
      record: recordView(
        record,
        displayStatus(record),
        `${borrower.firstName} ${borrower.lastName}`,
        item?.name ?? null
      ),
    },
    201
  );
});
