import crypto from 'crypto';
import { json, route } from '@/lib/api';
import { ApiError } from '@/lib/errors';
import { logAction } from '@/lib/audit';
import { RETENTION_DAYS, runRetention } from '@/lib/retention';
import { activeUserOrNull } from '@/lib/auth';

/**
 * The retention sweep, on a schedule.
 *
 * Two ways in, and no third:
 *  - Vercel Cron, proved by the `CRON_SECRET` bearer token Vercel sends.
 *  - An admin signed into the staff app, for a dry run they can read before
 *    trusting the schedule.
 *
 * `?dry=1` reports what would be removed and changes nothing. Anything else
 * destroys personal data irreversibly, which is the entire point — so the
 * result is written to the audit log either way.
 */
export const GET = route(async (req: Request) => {
  const url = new URL(req.url);
  const dryRun = url.searchParams.get('dry') === '1';

  const secret = process.env.CRON_SECRET;
  const offered = req.headers.get('authorization') ?? '';
  const fromCron = Boolean(secret) && timingSafeEqual(offered, `Bearer ${secret}`);

  const admin = fromCron ? null : await activeUserOrNull();
  if (!fromCron && admin?.role !== 'admin') {
    // Same answer whether the token was wrong or absent: this endpoint should
    // not confirm that it is a cron endpoint to anyone poking at it.
    throw new ApiError('ไม่มีสิทธิ์เข้าถึง', 403);
  }

  // The real sweep logs itself, so every route into it is covered. Only the
  // preview needs recording here — worth knowing who went looking.
  const result = await runRetention({ dryRun, actor: admin });

  if (dryRun) {
    await logAction({
      actor: admin,
      action: 'retention_preview',
      targetType: 'borrower',
      targetId: '',
      details: `ตรวจสอบ: เข้าเกณฑ์ลบ ${result.scanned} ราย (ยังไม่ได้ลบ)`,
    });
  }

  return json({
    dry_run: dryRun,
    retention_days: RETENTION_DAYS,
    eligible: result.scanned,
    anonymised: result.anonymised,
    photos_deleted: result.photosDeleted,
  });
});

/** Constant-time, and safe when the lengths differ. */
function timingSafeEqual(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  if (x.length !== y.length) return false;
  return crypto.timingSafeEqual(x, y);
}
