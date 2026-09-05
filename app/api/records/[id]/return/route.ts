import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { borrowers, equipment } from '@/lib/db/schema';
import { json, requireAuth, route } from '@/lib/api';
import { displayStatus, returnBorrow } from '@/lib/borrow';
import { recordView } from '@/lib/views';

type Ctx = { params: Promise<{ id: string }> };

export const PUT = route<Ctx>(async (req, { params }) => {
  const user = await requireAuth();
  const { id } = await params;
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;

  const record = await returnBorrow({
    recordId: id,
    receivedBy: user,
    conditionOnReturn: body.condition_on_return ? String(body.condition_on_return) : '',
  });

  const [borrower] = await db
    .select()
    .from(borrowers)
    .where(eq(borrowers.borrowerId, record.borrowerId));
  const [item] = await db
    .select()
    .from(equipment)
    .where(eq(equipment.equipmentId, record.equipmentId));

  return json({
    record: recordView(
      record,
      displayStatus(record),
      borrower ? `${borrower.firstName} ${borrower.lastName}` : null,
      item?.name ?? null
    ),
  });
});
