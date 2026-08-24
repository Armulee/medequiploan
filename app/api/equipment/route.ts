import { asc } from 'drizzle-orm';
import { db } from '@/lib/db';
import { equipment } from '@/lib/db/schema';
import { ApiError, json, requireRole, route } from '@/lib/api';
import { logAction } from '@/lib/audit';
import { equipmentView } from '@/lib/views';

// Left public: the public request form needs the catalogue to show what can be
// borrowed. No borrower data is exposed here.
export const GET = route(async () => {
  const rows = await db.select().from(equipment).orderBy(asc(equipment.equipmentId));
  return json({ equipment: rows.map(equipmentView) });
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
