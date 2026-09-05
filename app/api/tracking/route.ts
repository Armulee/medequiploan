import { desc, eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { borrowers, equipment, records, requests } from '@/lib/db/schema';
import { ApiError, json, route } from '@/lib/api';
import { nationalIdHash } from '@/lib/crypto';
import { isValidThaiNationalId } from '@/lib/validate';
import { RULES, clientIp, hit, sweepExpired, tooManyRequests } from '@/lib/rate-limit';
import { requireHuman } from '@/lib/turnstile';
import { displayStatus } from '@/lib/borrow';

/**
 * Public status lookup by national ID.
 *
 * POST rather than GET on purpose: a national ID in a query string ends up in
 * browser history, the Referer header and the platform's access logs. In a
 * request body it stays out of all three.
 *
 * The response deliberately carries no personal data back — no name, address,
 * phone or photo, and never the ID itself. Someone holding a national ID
 * learns only the status of the requests made with it, which is what they
 * came for; it does not become a way to look up who a person is.
 */
export const POST = route(async (req: Request) => {
  void sweepExpired();

  // Unauthenticated and keyed on a guessable-ish number, so the throttle is
  // what stops it being walked. Same bucket shape as the other public route.
  const ip = clientIp(req);
  const limit = await hit(`tracking:ip:${ip}`, RULES.trackingPerIp);
  if (!limit.allowed) throw tooManyRequests(limit.retryAfterSeconds);

  const body = (await req.json().catch(() => ({}))) as {
    national_id?: string;
    turnstile_token?: string;
  };

  // This endpoint answers questions about a national ID. Rate limiting alone
  // only slows a sweep down; the challenge makes an automated one impractical.
  await requireHuman(body.turnstile_token, ip);
  const nationalId = String(body.national_id ?? '').replace(/\D/g, '');

  if (!isValidThaiNationalId(nationalId)) {
    throw new ApiError('เลขบัตรประชาชนไม่ถูกต้อง (ต้องเป็นตัวเลข 13 หลัก)');
  }

  const [borrower] = await db
    .select({ borrowerId: borrowers.borrowerId })
    .from(borrowers)
    .where(eq(borrowers.nationalIdHash, nationalIdHash(nationalId)));

  // An unregistered ID and a registered one with no requests answer
  // identically, so this cannot be used to test whether a person is in the
  // system at all.
  if (!borrower) return json({ requests: [], loans: [] });

  const [requestRows, loanRows] = await Promise.all([
    db
      .select({
        requestId: requests.requestId,
        requestedAt: requests.requestedAt,
        status: requests.status,
        note: requests.note,
        recordId: requests.recordId,
        dueDate: records.dueDate,
        equipmentName: equipment.name,
      })
      .from(requests)
      .leftJoin(equipment, eq(requests.equipmentId, equipment.equipmentId))
      .leftJoin(records, eq(requests.recordId, records.recordId))
      .where(eq(requests.borrowerId, borrower.borrowerId))
      .orderBy(desc(requests.requestedAt))
      .limit(20),
    db
      .select({
        recordId: records.recordId,
        borrowDate: records.borrowDate,
        dueDate: records.dueDate,
        returnDate: records.returnDate,
        status: records.status,
        equipmentName: equipment.name,
      })
      .from(records)
      .leftJoin(equipment, eq(records.equipmentId, equipment.equipmentId))
      .where(eq(records.borrowerId, borrower.borrowerId))
      .orderBy(desc(records.borrowDate))
      .limit(20),
  ]);

  return json({
    requests: requestRows.map((r) => ({
      request_id: r.requestId,
      requested_at: r.requestedAt,
      status: r.status,
      // Only shown for a rejection, where it is the reason the person needs.
      note: r.status === 'ปฏิเสธ' ? r.note : '',
      // And the return date once approved, which is what they need next.
      due_date: r.status === 'อนุมัติ' ? r.dueDate : null,
      equipment_name: r.equipmentName ?? '-',
    })),
    loans: loanRows.map((r) => ({
      record_id: r.recordId,
      borrow_date: r.borrowDate,
      due_date: r.dueDate,
      return_date: r.returnDate,
      status: displayStatus(r),
      equipment_name: r.equipmentName ?? '-',
    })),
  });
});
