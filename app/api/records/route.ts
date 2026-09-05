import { and, desc, eq, gte, isNull, lt, ne, or, sql, type SQL } from 'drizzle-orm';
import { db } from '@/lib/db';
import { borrowers, equipment, records } from '@/lib/db/schema';
import { ApiError, json, pageParams, requireAuth, route } from '@/lib/api';
import { displayStatus, issueBorrow } from '@/lib/borrow';
import { recordView } from '@/lib/views';

/**
 * Status is derived at read time — a loan becomes overdue on its own, without
 * a nightly job — so filtering by it means rebuilding that rule in SQL rather
 * than mapping every row and filtering the array. Which the old code did, and
 * which meant loading every loan ever recorded to show twenty of them.
 */
function statusFilter(status: string): SQL | undefined {
  const open = ne(records.status, 'คืนแล้ว');
  if (status === 'คืนแล้ว') return eq(records.status, 'คืนแล้ว');
  if (status === 'เกินกำหนด') return and(open, lt(records.dueDate, sql`now()`));
  if (status === 'ยืมอยู่') {
    return and(open, or(isNull(records.dueDate), gte(records.dueDate, sql`now()`)));
  }
  // 'active' is every loan not yet closed, overdue or not — the returns queue.
  if (status === 'active') return open;
  return undefined;
}

export const GET = route(async (req: Request) => {
  await requireAuth();
  const sp = new URL(req.url).searchParams;

  const filters: SQL[] = [];
  const borrowerId = sp.get('borrower_id');
  const equipmentId = sp.get('equipment_id');
  const status = sp.get('status');
  if (borrowerId) filters.push(eq(records.borrowerId, borrowerId));
  if (equipmentId) filters.push(eq(records.equipmentId, equipmentId));
  if (status) {
    const f = statusFilter(status);
    if (f) filters.push(f);
  }
  const where = filters.length ? and(...filters) : undefined;

  const page = pageParams(sp);
  const query = db
    .select({
      record: records,
      borrowerFirst: borrowers.firstName,
      borrowerLast: borrowers.lastName,
      equipmentName: equipment.name,
    })
    .from(records)
    .leftJoin(borrowers, eq(records.borrowerId, borrowers.borrowerId))
    .leftJoin(equipment, eq(records.equipmentId, equipment.equipmentId))
    .where(where)
    // Tie-broken by id so a page boundary can't repeat or skip a row when
    // several loans share a borrow date.
    .orderBy(desc(records.borrowDate), desc(records.recordId))
    .$dynamic();

  const rows = await (page ? query.limit(page.limit).offset(page.offset) : query);

  const list = rows.map((r) =>
    recordView(
      r.record,
      displayStatus(r.record),
      r.borrowerFirst ? `${r.borrowerFirst} ${r.borrowerLast}` : null,
      r.equipmentName
    )
  );

  // Counted with the same filter but no join: the list shows "N of M" and M
  // has to be the whole matching set, not the page.
  const total = page
    ? Number(
        (
          await db
            .select({ n: sql<number>`count(*)::int` })
            .from(records)
            .where(where)
        )[0]?.n ?? 0
      )
    : list.length;

  return json({ records: list, total });
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
