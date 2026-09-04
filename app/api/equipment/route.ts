import { asc, ne, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { equipment, records } from '@/lib/db/schema';
import { ApiError, json, requireRole, route } from '@/lib/api';
import { logAction } from '@/lib/audit';
import { equipmentView } from '@/lib/views';

// Left public: the public request form needs the catalogue to show what can be
// borrowed. No borrower data is exposed here.
export const GET = route(async () => {
  const [rows, loans] = await Promise.all([
    db.select().from(equipment).orderBy(asc(equipment.equipmentId)),
    // One grouped count for the whole catalogue rather than a query per item.
    db
      .select({ equipmentId: records.equipmentId, onLoan: sql<number>`count(*)::int` })
      .from(records)
      .where(ne(records.status, 'คืนแล้ว'))
      .groupBy(records.equipmentId),
  ]);

  const onLoanById = new Map(loans.map((l) => [l.equipmentId, Number(l.onLoan)]));
  return json({ equipment: rows.map((e) => equipmentView(e, onLoanById.get(e.equipmentId) ?? 0)) });
});

export const POST = route(async (req: Request) => {
  const user = await requireRole('admin');
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;

  const name = String(body.name ?? '').trim();
  const qty = Number.parseInt(String(body.total_qty ?? ''), 10);
  if (!name) throw new ApiError('กรุณากรอกชื่ออุปกรณ์');
  if (!Number.isFinite(qty) || qty < 0) throw new ApiError('จำนวนไม่ถูกต้อง');

  const thresholdRaw = Number.parseInt(String(body.low_stock_threshold ?? ''), 10);

  const [created] = await db
    .insert(equipment)
    .values({
      name,
      category: String(body.category ?? '').trim(),
      totalQty: qty,
      availableQty: qty,
      lowStockThreshold: Number.isFinite(thresholdRaw) && thresholdRaw >= 0 ? thresholdRaw : 2,
    })
    .returning();

  await logAction({
    actor: user,
    action: 'create_equipment',
    targetType: 'equipment',
    targetId: created.equipmentId,
  });

  return json({ equipment: equipmentView(created) }, 201);
});
