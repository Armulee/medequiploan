import { eq, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { equipment } from '@/lib/db/schema';
import { ApiError, json, requireRole, route } from '@/lib/api';
import { logAction } from '@/lib/audit';
import { equipmentView } from '@/lib/views';

type Ctx = { params: Promise<{ id: string }> };

export const GET = route<Ctx>(async (_req, { params }) => {
  const { id } = await params;
  const [found] = await db.select().from(equipment).where(eq(equipment.equipmentId, id));
  if (!found) throw new ApiError('ไม่พบอุปกรณ์', 404);
  return json({ equipment: equipmentView(found) });
});

export const PUT = route<Ctx>(async (req, { params }) => {
  const user = await requireRole('admin');
  const { id } = await params;
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;

  const [current] = await db.select().from(equipment).where(eq(equipment.equipmentId, id));
  if (!current) throw new ApiError('ไม่พบอุปกรณ์', 404);

  const patch: Partial<typeof equipment.$inferInsert> = {};

  if (body.name !== undefined) {
    const name = String(body.name).trim();
    if (!name) throw new ApiError('ชื่ออุปกรณ์ว่างไม่ได้');
    patch.name = name;
  }
  if (body.category !== undefined) patch.category = String(body.category).trim();

  if (body.low_stock_threshold !== undefined) {
    const t = Number.parseInt(String(body.low_stock_threshold), 10);
    // Reject junk instead of writing NaN, which the old code stored as null.
    if (!Number.isFinite(t) || t < 0) throw new ApiError('ค่าแจ้งเตือนสต็อกใกล้หมดไม่ถูกต้อง');
    patch.lowStockThreshold = t;
  }

  if (body.total_qty !== undefined) {
    const qty = Number.parseInt(String(body.total_qty), 10);
    if (!Number.isFinite(qty) || qty < 0) throw new ApiError('จำนวนไม่ถูกต้อง');
    const borrowed = current.totalQty - current.availableQty;
    if (qty < borrowed) {
      throw new ApiError(`ตั้งจำนวนรวมต่ำกว่าจำนวนที่ถูกยืมอยู่ (${borrowed}) ไม่ได้`, 409);
    }
    patch.totalQty = qty;
    patch.availableQty = qty - borrowed; // keep borrowed count intact
  }

  if (Object.keys(patch).length === 0) return json({ equipment: equipmentView(current) });

  const [updated] = await db
    .update(equipment)
    .set(patch)
    .where(eq(equipment.equipmentId, id))
    .returning();

  await logAction({
    actor: user,
    action: 'update_equipment',
    targetType: 'equipment',
    targetId: id,
    details: Object.keys(patch).join(','),
  });

  return json({ equipment: equipmentView(updated) });
});
