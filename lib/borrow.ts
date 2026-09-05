import { eq, sql } from 'drizzle-orm';
import { db, rowsOf } from './db';
import { equipment, records, type LoanRecord } from './db/schema';
import { logAction } from './audit';
import { ApiError } from './api';
import type { SessionUser } from './session';

/**
 * `RETURNING *` on a raw statement comes back with the database's snake_case
 * column names, not the camelCase shape Drizzle's query builder produces. Map
 * it explicitly — reading `.recordId` off the raw row silently yields
 * undefined, which is how the borrow audit entry ended up with a blank
 * target_id and how displayStatus() stopped ever seeing a due date.
 */
type RawRecordRow = Record<string, unknown>;

function toLoanRecord(raw: RawRecordRow): LoanRecord {
  const date = (v: unknown) => (v == null ? null : new Date(v as string));
  return {
    recordId: String(raw.record_id),
    borrowerId: String(raw.borrower_id),
    equipmentId: String(raw.equipment_id),
    borrowDate: date(raw.borrow_date) as Date,
    dueDate: date(raw.due_date),
    returnDate: date(raw.return_date),
    status: String(raw.status),
    conditionOnReturn: String(raw.condition_on_return ?? ''),
    handledBy: raw.handled_by == null ? null : String(raw.handled_by),
    handledByName: String(raw.handled_by_name ?? ''),
    receivedBy: raw.received_by == null ? null : String(raw.received_by),
    receivedByName: String(raw.received_by_name ?? ''),
    source: String(raw.source),
  };
}

// Shared by the staff-direct borrow flow and by approving a public request, so
// stock counts and the audit trail stay consistent whichever path created them.

/**
 * Decrement stock and create the loan record in ONE statement.
 *
 * The JSON-file version did these as two separate writes to two separate
 * files: stock came down first, then the record was written. If anything threw
 * in between, a unit vanished from the shelf with no loan to explain it. And
 * because the availability check was a separate read, two staff clicking at the
 * same moment could both pass the check on the last remaining unit.
 *
 * A data-modifying CTE fixes both: the UPDATE's `available_qty > 0` guard is
 * evaluated and applied atomically, and the INSERT only produces a row if that
 * UPDATE actually matched. No match means no stock — nothing is written.
 */
export async function issueBorrow(input: {
  borrowerId: string;
  equipmentId: string;
  dueDate: Date | null;
  handledBy: SessionUser;
  source: 'direct' | 'request';
}): Promise<LoanRecord> {
  const { borrowerId, equipmentId, dueDate, handledBy, source } = input;

  const result = await db.execute(sql`
    WITH taken AS (
      UPDATE ${equipment}
         SET available_qty = available_qty - 1
       WHERE equipment_id = ${equipmentId}
         AND available_qty > 0
      RETURNING equipment_id
    )
    INSERT INTO ${records} (
      borrower_id, equipment_id, due_date, status,
      handled_by, handled_by_name, source
    )
    SELECT ${borrowerId}, taken.equipment_id, ${dueDate}, 'ยืมอยู่',
           ${handledBy.user_id}, ${handledBy.name}, ${source}
      FROM taken
    RETURNING *
  `);

  const raw = rowsOf<RawRecordRow>(result)[0];
  if (!raw) {
    // Either the equipment id doesn't exist or every unit is already out.
    const [item] = await db
      .select({ id: equipment.equipmentId })
      .from(equipment)
      .where(eq(equipment.equipmentId, equipmentId));
    if (!item) throw new ApiError('ไม่พบอุปกรณ์', 404);
    throw new ApiError('อุปกรณ์นี้ถูกยืมหมดแล้ว ไม่สามารถยืมได้', 409);
  }

  const row = toLoanRecord(raw);

  await logAction({
    actor: handledBy,
    action: 'borrow',
    targetType: 'record',
    targetId: row.recordId,
    details: `equipment=${equipmentId} borrower=${borrowerId}`,
  });

  return row;
}

/**
 * Close the loan and put the unit back, again in one statement.
 *
 * The `status <> 'คืนแล้ว'` guard is what makes a double-click safe: the second
 * request matches no row, so stock is never credited twice.
 */
export async function returnBorrow(input: {
  recordId: string;
  receivedBy: SessionUser;
  conditionOnReturn?: string;
}): Promise<LoanRecord> {
  const { recordId, receivedBy, conditionOnReturn } = input;

  const result = await db.execute(sql`
    WITH closed AS (
      UPDATE ${records}
         SET return_date = now(),
             status = 'คืนแล้ว',
             condition_on_return = ${conditionOnReturn ?? ''},
             received_by = ${receivedBy.user_id},
             received_by_name = ${receivedBy.name}
       WHERE record_id = ${recordId}
         AND status <> 'คืนแล้ว'
      RETURNING *
    ), restocked AS (
      UPDATE ${equipment}
         SET available_qty = LEAST(total_qty, available_qty + 1)
       WHERE equipment_id = (SELECT equipment_id FROM closed)
      RETURNING 1
    )
    SELECT * FROM closed
  `);

  const raw = rowsOf<RawRecordRow>(result)[0];
  if (!raw) {
    const [existing] = await db
      .select({ status: records.status })
      .from(records)
      .where(eq(records.recordId, recordId));
    if (!existing) throw new ApiError('ไม่พบรายการยืม', 404);
    throw new ApiError('รายการนี้คืนแล้ว', 409);
  }

  const row = toLoanRecord(raw);

  await logAction({
    actor: receivedBy,
    action: 'return',
    targetType: 'record',
    targetId: recordId,
    details: `equipment=${row.equipmentId} borrower=${row.borrowerId}`,
  });

  return row;
}

// Overdue is derived at read time rather than stored, so a loan becomes overdue
// on its own without a nightly job having to sweep the table.
export function displayStatus(record: Pick<LoanRecord, 'status' | 'dueDate'>): string {
  if (record.status === 'คืนแล้ว') return 'คืนแล้ว';
  if (record.dueDate && new Date(record.dueDate) < new Date()) return 'เกินกำหนด';
  return 'ยืมอยู่';
}
