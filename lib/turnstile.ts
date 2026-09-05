import { ApiError } from './errors';

/**
 * Cloudflare Turnstile, for the two endpoints anyone on the internet can hit.
 *
 * The rate limiter already caps how fast one address can post, but an address
 * costs almost nothing to change, and both endpoints are expensive in ways
 * that matter: the request form writes a borrower row and stores photographs
 * against the Blob quota, and the tracking lookup is a national-ID oracle that
 * a wide enough sweep could walk.
 *
 * Turnstile rather than a CAPTCHA because it usually asks the person nothing
 * at all — a site that makes someone in a hospital corridor identify traffic
 * lights before they can borrow a wheelchair has solved the wrong problem.
 *
 * Entirely optional. With no keys set the whole thing is a no-op, so the app
 * runs unchanged in development and for anyone who has not signed up for it.
 */
export function turnstileEnabled(): boolean {
  return Boolean(process.env.TURNSTILE_SECRET_KEY && process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY);
}

const VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

/**
 * Check the token the widget produced.
 *
 * Fails **closed** on a verdict about the token — one Cloudflare says is
 * invalid, expired or already spent is refused. Fails **open** when the check
 * could not honestly be made: Cloudflare unreachable, or our own secret key
 * misconfigured. Same reasoning as the rate limiter — a third party's outage,
 * or our own deployment mistake, must not stop a person borrowing medical
 * equipment. The rate limit is still underneath either way, so failing open is
 * a degraded gate, not an absent one.
 */
export async function requireHuman(token: unknown, ip: string): Promise<void> {
  if (!turnstileEnabled()) return;

  const response = String(token ?? '');
  if (!response) {
    throw new ApiError('กรุณายืนยันว่าไม่ใช่บอทก่อนส่งแบบฟอร์ม', 400);
  }

  let verdict: { success?: boolean; 'error-codes'?: string[] };
  try {
    const res = await fetch(VERIFY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        secret: String(process.env.TURNSTILE_SECRET_KEY),
        response,
        remoteip: ip,
      }),
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return openAfter(`siteverify ตอบ ${res.status}`);
    verdict = (await res.json()) as typeof verdict;
  } catch (e) {
    return openAfter(e instanceof Error ? e.message : 'ติดต่อ siteverify ไม่ได้');
  }

  if (verdict.success) return;

  const codes = verdict['error-codes'] ?? [];

  // Cloudflare distinguishes "this token is no good" from "your secret key is
  // no good", and they are not the same event at all. A wrong or missing
  // secret means EVERY submission is refused, and the person is told their
  // verification expired — a message that is untrue and that they cannot act
  // on. Nobody should lose access to medical equipment because someone pasted
  // the site key into the secret field, so this fails open and shouts.
  if (codes.some((c) => c.includes('input-secret'))) {
    return openAfter(`ตั้งค่า TURNSTILE_SECRET_KEY ผิด (${codes.join(', ')})`);
  }

  throw new ApiError('การยืนยันว่าไม่ใช่บอทหมดอายุแล้ว กรุณาลองใหม่อีกครั้ง', 400);
}

/**
 * Failing open, out loud.
 *
 * The dangerous version of this is the silent one: an egress rule or a
 * misconfigured deployment makes Cloudflare unreachable, every request sails
 * through, and the logs look exactly like a site nobody is attacking. A line
 * per skipped check is noisy during a real outage, which is the point — it is
 * the only signal that the gate is not actually closed.
 */
function openAfter(reason: string): void {
  console.warn(`[turnstile] ข้ามการตรวจเพราะติดต่อ Cloudflare ไม่ได้: ${reason}`);
}
