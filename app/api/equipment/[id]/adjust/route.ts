import { eq } from 'drizzle-orm';
import { db, rowsOf } from '@/lib/db';
import { equipment, stockAdjustments, type Equipment } from '@/lib/db/schema';
import { ApiError, json, requireRole, route } from '@/lib/api';
import { logAction } from '@/lib/audit';
import { equipmentView } from '@/lib/views';
import { sql } from 'drizzle-orm';

type Ctx = { params: Promise<{ id: string }> };

// Stock movements that are not borrow/return. Without these, a wheelchair that
// breaks stays "available" forever and the on-hand count drifts from reality.
const REASONS = {
  // Gone for good: comes out of both the total and what's on the shelf.
  ชำรุด: { total: true },
  สูญหาย: { total: true },
  // Temporarily out: off the shelf but still owned, so the total is unchanged.
  ส่งซ่อม: { total: false },
  รับกลับจากซ่อม: { total: false, restore: true },
  // New units: raises both the total owned and what is on the shelf.
  รับเข้าเพิ่ม: { total: true, add: true },
} as const;

type Reason = keyof typeof REASONS;

export const POST = route<Ctx>(async (req, { params }) => {
  const user = await requireRole('admin');
  const { id } = await params;
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;

  const reason = String(body.reason ?? '') as Reason;
  if (!(reason in REASONS)) {
    throw new ApiError(`เหตุผลไม่ถูกต้อง (ต้องเป็น ${Object.keys(REASONS).join(' / ')})`);
  }

  const qty = Number.parseInt(String(body.qty ?? ''), 10);
  if (!Number.isFinite(qty) || qty <= 0) throw new ApiError('จำนวนต้องเป็นตัวเลขมากกว่า 0');

  const note = String(body.note ?? '').trim();
  const rule = REASONS[reason];
  const restore = 'restore' in rule && rule.restore;
  const isAdd = 'add' in rule && rule.add;

  // One guarded statement so the count can't be driven negative (or above the
  // total when restoring) by two admins adjusting at the same moment.
  const result = isAdd
    ? await db.execute(sql`
        UPDATE ${equipment}
           SET available_qty = available_qty + ${qty},
               total_qty = total_qty + ${qty}
         WHERE equipment_id = ${id}
        RETURNING *
      `)
    : restore
    ? await db.execute(sql`
        UPDATE ${equipment}
           SET available_qty = available_qty + ${qty}
         WHERE equipment_id = ${id}
           AND available_qty + ${qty} <= total_qty
        RETURNING *
      `)
    : rule.total
      ? await db.execute(sql`
          UPDATE ${equipment}
             SET available_qty = available_qty - ${qty},
                 total_qty = total_qty - ${qty}
           WHERE equipment_id = ${id}
             AND available_qty >= ${qty}
          RETURNING *
        `)
      : await db.execute(sql`
          UPDATE ${equipment}
             SET available_qty = available_qty - ${qty}
           WHERE equipment_id = ${id}
             AND available_qty >= ${qty}
          RETURNING *
        `);

  const raw = rowsOf<Record<string, unknown>>(result)[0];
  if (!raw) {
    const [current] = await db.select().from(equipment).where(eq(equipment.equipmentId, id));
    if (!current) throw new ApiError('ไม่พบอุปกรณ์', 404);
    throw new ApiError(
      restore
        ? `รับกลับ ${qty} ชิ้นไม่ได้ จะเกินจำนวนทั้งหมด (${current.totalQty})`
        : `จำนวนคงเหลือไม่พอ (เหลือ ${current.availableQty} ชิ้น)`,
      409
    );
  }

  const updated: Equipment = {
    equipmentId: String(raw.equipment_id),
    name: String(raw.name),
    category: String(raw.category ?? ''),
    totalQty: Number(raw.total_qty),
    availableQty: Number(raw.available_qty),
    lowStockThreshold: Number(raw.low_stock_threshold),
  };

  await db.insert(stockAdjustments).values({
    equipmentId: id,
    reason,
    qty,
    note,
    adjustedBy: user.user_id,
    adjustedByName: user.name,
  });

  await logAction({
    actor: user,
    action: isAdd ? 'add_stock' : 'adjust_stock',
    targetType: 'equipment',
    targetId: id,
    details: `${reason} ${qty} ชิ้น${note ? ` (${note})` : ''}`,
  });

  return json({ equipment: equipmentView(updated) }, 201);
});

export const GET = route<Ctx>(async (_req, { params }) => {
  await requireRole('admin');
  const { id } = await params;
  const rows = await db
    .select()
    .from(stockAdjustments)
    .where(eq(stockAdjustments.equipmentId, id))
    .orderBy(stockAdjustments.at);

  return json({
    adjustments: rows.map((a) => ({
      adjustment_id: a.adjustmentId,
      equipment_id: a.equipmentId,
      reason: a.reason,
      qty: a.qty,
      note: a.note,
      adjusted_by_name: a.adjustedByName,
      at: a.at,
    })),
  });
});
