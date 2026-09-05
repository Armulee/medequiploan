import { sql } from 'drizzle-orm';
import { db, rowsOf } from './db';
import { ApiError } from './api';

/**
 * Fixed-window rate limiting backed by Postgres.
 *
 * Serverless invocations don't share memory, so an in-process counter would
 * reset on every cold start and enforce nothing. Postgres is already a
 * dependency, which is why it is used here in preference to adding Redis —
 * one extra round trip is irrelevant at this system's traffic.
 */

export type Rule = { limit: number; windowSeconds: number };

export const RULES = {
  /**
   * Wrong passwords for one account FROM ONE ADDRESS.
   *
   * Keyed on the pair, not on the username alone. A username-only bucket is a
   * denial of service handed to anyone who can guess a username: five wrong
   * passwords against `admin` every fifteen minutes, from a script, and the
   * real admin can never sign in again. Usernames here are guessable by
   * design — the seed creates `admin` and `staff`.
   *
   * The pair still stops the attack the bucket is for, because guessing a
   * password needs thousands of attempts and an attacker changing address
   * every five tries is caught by the per-address bucket below.
   */
  loginPerUserIp: { limit: 5, windowSeconds: 15 * 60 },
  /** Wrong passwords from one address, whichever accounts they were aimed at. */
  loginPerIp: { limit: 20, windowSeconds: 15 * 60 },
  /**
   * Wrong passwords against one account from every address at once.
   *
   * Deliberately far above the per-pair limit: this is the backstop for a
   * distributed guess at a single account, and it is high enough that no
   * plausible number of real people mistyping their own password reaches it.
   */
  loginPerUserGlobal: { limit: 100, windowSeconds: 60 * 60 },
  /** Public borrow requests, which create borrower rows and upload photos. */
  publicRequestPerIp: { limit: 5, windowSeconds: 60 * 60 },
  /**
   * Wrong current-password attempts while changing one's own credentials.
   * A logged-in session already proves identity, so this only has to stop a
   * borrowed unlocked screen being used to guess the password.
   */
  accountChangePerUser: { limit: 5, windowSeconds: 15 * 60 },
  /**
   * Status lookups. Unauthenticated and keyed on a national ID, so without a
   * ceiling it could be walked; 15 an hour is far more than anyone checking
   * their own request needs.
   */
  trackingPerIp: { limit: 15, windowSeconds: 60 * 60 },
} satisfies Record<string, Rule>;

export type Decision = { allowed: boolean; remaining: number; retryAfterSeconds: number };

/**
 * Counts one hit against `key` and reports whether it may proceed.
 *
 * The upsert is a single statement: reading the counter and writing it back
 * separately would let simultaneous attempts both read the same value and slip
 * past the limit — the same reason borrow/return are single statements.
 */
export async function hit(key: string, rule: Rule): Promise<Decision> {
  const { limit, windowSeconds } = rule;

  try {
    const result = await db.execute(sql`
      INSERT INTO rate_limits (key, count, window_start)
      VALUES (${key}, 1, now())
      ON CONFLICT (key) DO UPDATE SET
        count = CASE
          WHEN rate_limits.window_start < now() - make_interval(secs => ${windowSeconds})
          THEN 1 ELSE rate_limits.count + 1 END,
        window_start = CASE
          WHEN rate_limits.window_start < now() - make_interval(secs => ${windowSeconds})
          THEN now() ELSE rate_limits.window_start END
      RETURNING count,
                greatest(0, ${windowSeconds} - EXTRACT(EPOCH FROM now() - window_start))::int AS retry_after
    `);

    const row = rowsOf<{ count: number | string; retry_after: number | string }>(result)[0];
    if (!row) return { allowed: true, remaining: limit, retryAfterSeconds: 0 };

    const count = Number(row.count);
    return {
      allowed: count <= limit,
      remaining: Math.max(0, limit - count),
      retryAfterSeconds: Number(row.retry_after) || windowSeconds,
    };
  } catch (err) {
    // Fail open. If the limiter itself is broken, letting requests through is
    // far less damaging than locking every member of staff out of the system
    // because of a fault in the thing meant to stop spam.
    console.error('rate limit check failed, allowing request:', err);
    return { allowed: true, remaining: limit, retryAfterSeconds: 0 };
  }
}

/** Clears a subject's counter — called after a login succeeds. */
export async function reset(key: string): Promise<void> {
  try {
    await db.execute(sql`DELETE FROM rate_limits WHERE key = ${key}`);
  } catch (err) {
    console.error('rate limit reset failed:', err);
  }
}

export function tooManyRequests(retryAfterSeconds: number): ApiError {
  const minutes = Math.max(1, Math.ceil(retryAfterSeconds / 60));
  return new ApiError(
    `พยายามหลายครั้งเกินไป กรุณารออีกประมาณ ${minutes} นาทีแล้วลองใหม่`,
    429,
    Math.max(1, retryAfterSeconds)
  );
}

/**
 * The caller's address, from the header Vercel's edge sets. It carries the
 * client first, then each proxy. Outside a trusted proxy this header is
 * client-supplied and therefore forgeable, so treat the limit as protection
 * against bots and scripted guessing rather than a determined attacker.
 */
export function clientIp(req: Request): string {
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) {
    const first = forwarded.split(',')[0]?.trim();
    if (first) return first;
  }
  return req.headers.get('x-real-ip')?.trim() || 'unknown';
}

/** Opportunistic cleanup so abandoned buckets don't accumulate forever. */
export async function sweepExpired(): Promise<void> {
  if (Math.random() > 0.02) return; // ~1 in 50 requests
  try {
    await db.execute(sql`DELETE FROM rate_limits WHERE window_start < now() - interval '1 day'`);
  } catch {
    // Housekeeping only — never let this affect the request.
  }
}
