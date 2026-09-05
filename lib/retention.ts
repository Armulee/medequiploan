import { eq, sql } from 'drizzle-orm';
import { db } from './db';
import { borrowers, requests } from './db/schema';
import { deleteUpload } from './storage';
import { encrypt, nationalIdHash } from './crypto';
import { SYSTEM_ACTOR, logAction } from './audit';
import type { SessionUser } from './session';

/**
 * Deleting personal data once it is no longer needed.
 *
 * The consent notice tells every person "เก็บต่ออีก 2 ปีหลังการยืมครั้งสุดท้าย
 * จากนั้นจะลบหรือทำให้ไม่สามารถระบุตัวตนได้". Until this existed, that was a
 * promise the system could not keep — which under PDPA is worse than not
 * making it, because the notice is what consent was given against.
 *
 * The row is not deleted. Every loan, return and approval names the borrower
 * it belongs to, and every audit entry names what was acted on; removing the
 * row would turn years of history into dangling ids and destroy exactly the
 * record an audit would ask for. What is removed is everything that makes the
 * row a person: the name, the national ID, the address, the phone, the LINE
 * id, the email, the illness description, and both photographs — the files
 * themselves, not just the references.
 *
 * What is left is a numbered borrower with a registration date and a loan
 * history, which identifies nobody.
 */

/** Two years after the last loan, per the notice. */
export const RETENTION_DAYS = 730;

export type RetentionResult = {
  scanned: number;
  anonymised: string[];
  photosDeleted: number;
};

/**
 * Who is eligible.
 *
 * A borrower qualifies when they have no loan still open, and their most
 * recent contact of any kind is older than the retention window: a loan taken
 * out, a loan handed back, a request submitted, or — for someone who
 * registered and never borrowed — the registration itself.
 *
 * The return date counts, not just the borrow date. Someone who took a
 * wheelchair out three years ago and returned it last week was standing in
 * front of a member of staff last week; deleting their record now would be
 * both surprising to them and useless to the audit trail. Counting from the
 * later of the two can only ever keep data longer than the notice promises,
 * never shorter, which is the right way round to be wrong.
 *
 * `verified` is deliberately not part of it: an unverified registration from
 * three years ago is still somebody's ID card sitting in a bucket.
 *
 * Rows already swept are skipped by `anonymised_at`, so the job is safe to run
 * as often as you like.
 */
async function eligible(cutoff: Date): Promise<string[]> {
  const rows = await db.execute(sql`
    SELECT b.borrower_id
    FROM borrowers b
    WHERE b.anonymised_at IS NULL
      AND NOT EXISTS (
        SELECT 1 FROM records r
        WHERE r.borrower_id = b.borrower_id AND r.return_date IS NULL
      )
      AND GREATEST(
        b.registered_at,
        COALESCE((
          SELECT max(GREATEST(r.borrow_date, COALESCE(r.return_date, r.borrow_date)))
          FROM records r WHERE r.borrower_id = b.borrower_id
        ), b.registered_at),
        COALESCE((SELECT max(q.requested_at) FROM requests q WHERE q.borrower_id = b.borrower_id), b.registered_at)
      ) < ${cutoff.toISOString()}::timestamptz
    ORDER BY b.borrower_id
  `);
  // db.execute() returns snake_case, not Drizzle's camelCase.
  const list = (Array.isArray(rows) ? rows : (rows as { rows?: unknown[] }).rows) ?? [];
  return (list as Array<{ borrower_id: string }>).map((r) => r.borrower_id);
}

/**
 * Run the sweep.
 *
 * `dryRun` reports what would go without touching anything, which is the only
 * responsible way to look at a job that destroys data irreversibly.
 */
export async function runRetention({
  days = RETENTION_DAYS,
  dryRun = false,
  actor = null,
}: { days?: number; dryRun?: boolean; actor?: SessionUser | null } = {}): Promise<RetentionResult> {
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const ids = await eligible(cutoff);
  const result: RetentionResult = { scanned: ids.length, anonymised: [], photosDeleted: 0 };
  if (dryRun) {
    result.anonymised = ids;
    return result;
  }

  for (const id of ids) {
    const [borrower] = await db.select().from(borrowers).where(eq(borrowers.borrowerId, id));
    if (!borrower) continue;

    // Every photograph this person ever attached: the two on their record, and
    // the ones sent with each request. Files first — a row cleared while its
    // photos survive in the bucket is the worst of both outcomes.
    const attached = await db
      .select({ idCard: requests.idCardPhotoId, illness: requests.illnessPhotoId })
      .from(requests)
      .where(eq(requests.borrowerId, id));

    const files = new Set(
      [
        borrower.idCardPhotoId,
        borrower.illnessPhotoId,
        ...attached.flatMap((r) => [r.idCard, r.illness]),
      ].filter((f): f is string => Boolean(f))
    );
    for (const file of files) {
      await deleteUpload(file);
      result.photosDeleted += 1;
    }

    // The national ID columns are NOT NULL and the hash is unique, so neither
    // can simply be emptied. Both are overwritten with a value derived from
    // the borrower id: unique by construction, so the index stays satisfied,
    // and outside the range of any hash a real 13-digit ID could produce, so
    // it can never be mistaken for one — including by the "have we seen this
    // person before?" lookup, which is how someone whose data was deleted can
    // register again later as a new borrower.
    await db
      .update(borrowers)
      .set({
        firstName: 'ลบข้อมูลแล้ว',
        lastName: `(${id})`,
        nationalIdEnc: encrypt('0000000000000'),
        nationalIdHash: nationalIdHash(`anonymised:${id}`),
        address: '',
        phone: '',
        lineId: '',
        email: '',
        illnessDescription: '',
        illnessPhotoId: null,
        idCardPhotoId: null,
        anonymisedAt: new Date(),
      })
      .where(eq(borrowers.borrowerId, id));

    // The copies a request kept of what was typed into the public form.
    await db
      .update(requests)
      .set({
        contactName: '',
        contactPhone: '',
        contactLineId: '',
        contactEmail: '',
        contactAddress: '',
        idCardPhotoId: null,
        illnessPhotoId: null,
      })
      .where(eq(requests.borrowerId, id));

    result.anonymised.push(id);
  }

  // Logged here rather than at each call site, so the entry exists whether the
  // sweep was run by the weekly cron, by an admin in the app, or by someone at
  // a terminal. Destroying personal data without a record of having done it is
  // exactly the thing PDPA compliance is supposed to be able to show.
  if (result.anonymised.length > 0) {
    await logAction({
      // Nobody signed in means the weekly cron or the CLI, not a passer-by.
      actor: actor ?? SYSTEM_ACTOR,
      action: 'retention_sweep',
      targetType: 'borrower',
      targetId: '',
      details:
        `ลบข้อมูลส่วนบุคคล ${result.anonymised.length} ราย (ไม่มีการยืม ${days} วัน) ` +
        `และรูป ${result.photosDeleted} ไฟล์ · ${result.anonymised.join(', ')}`,
    });
  }

  return result;
}
