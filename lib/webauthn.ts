import { and, eq, lt } from 'drizzle-orm';
import crypto from 'crypto';
import { db } from './db';
import { passkeys, webauthnChallenges } from './db/schema';

/**
 * WebAuthn for staff sign-in.
 *
 * Passkeys rather than a TOTP code, because the attack this system actually
 * faces is phishing: a convincing copy of the login page, and a six-digit code
 * relayed to the real one within its thirty seconds. A passkey is bound to the
 * origin it was created for, so the copy simply cannot use it. It is also less
 * work for the person — a face or a fingerprint, not an app and a stopwatch.
 */

/**
 * One caveat worth knowing: WebAuthn refuses to work on a bare IP address —
 * an RP id must be a domain. `localhost` is fine (browsers treat it as a
 * secure context), `127.0.0.1` is not. That only bites in development and in
 * tests; production is a real domain over https.
 */

/** Five minutes is longer than any real ceremony and short enough to matter. */
const CHALLENGE_TTL_MS = 5 * 60 * 1000;

export const RP_NAME = 'ศูนย์ยืม-คืนกายอุปกรณ์';

/**
 * The host the browser thinks it is on.
 *
 * Not `new URL(req.url).host`: behind a proxy — Vercel in production, the dev
 * server locally — that is the internal address the request arrived at, and
 * it disagrees with the address in the address bar. WebAuthn compares both
 * the RP id and the origin against what the browser actually saw, so a
 * mismatch here does not degrade gracefully, it refuses to enrol at all.
 */
function browserHost(req: Request): string {
  const h = req.headers;
  const forwarded = h.get('x-forwarded-host');
  return (forwarded ?? h.get('host') ?? new URL(req.url).host).split(',')[0].trim();
}

/**
 * The relying party id: the registrable domain a credential is bound to.
 *
 * Derived from the request so local development, previews and production each
 * work without a per-environment variable. Taking it from a header is safe
 * because the browser is the thing enforcing it — it refuses any RP id that
 * is not a suffix of the page's real origin, so a forged Host cannot make it
 * mint a credential for somebody else's domain. Set WEBAUTHN_RP_ID anyway in
 * production: it pins the value, and it is what lets the app be served from a
 * subdomain while credentials cover the parent domain.
 *
 * The port is stripped — an RP id is a domain, never host:port.
 */
export function rpId(req: Request): string {
  const configured = process.env.WEBAUTHN_RP_ID;
  if (configured) return configured;
  return browserHost(req).replace(/:\d+$/, '');
}

/** Exactly what the browser will put in clientDataJSON.origin. */
export function origin(req: Request): string {
  const host = browserHost(req);
  const proto =
    req.headers.get('x-forwarded-proto')?.split(',')[0].trim() ??
    new URL(req.url).protocol.replace(':', '');
  return `${proto}://${host}`;
}

/** Store a challenge and hand back the id that will be sent with the answer. */
export async function saveChallenge(
  challenge: string,
  purpose: 'register' | 'login',
  userId: string | null
): Promise<string> {
  // Opportunistic cleanup; expired rows are never valid, so this is only tidying.
  await db
    .delete(webauthnChallenges)
    .where(lt(webauthnChallenges.expiresAt, new Date()))
    .catch(() => {});

  const id = crypto.randomBytes(24).toString('base64url');
  await db.insert(webauthnChallenges).values({
    challengeId: id,
    challenge,
    userId,
    purpose,
    expiresAt: new Date(Date.now() + CHALLENGE_TTL_MS),
  });
  return id;
}

/**
 * Take a challenge back out. Single use: it is deleted whether or not the
 * answer turns out to be valid, so a captured response cannot be replayed.
 */
export async function takeChallenge(
  id: string,
  purpose: 'register' | 'login'
): Promise<{ challenge: string; userId: string | null } | null> {
  if (!id) return null;
  const [row] = await db
    .delete(webauthnChallenges)
    .where(and(eq(webauthnChallenges.challengeId, id), eq(webauthnChallenges.purpose, purpose)))
    .returning();
  if (!row) return null;
  if (row.expiresAt.getTime() < Date.now()) return null;
  return { challenge: row.challenge, userId: row.userId };
}

/** How many passkeys an account has — the gate for "must enrol" and for
 *  "password sign-in is no longer accepted". */
export async function passkeyCount(userId: string): Promise<number> {
  const rows = await db
    .select({ id: passkeys.passkeyId })
    .from(passkeys)
    .where(eq(passkeys.userId, userId));
  return rows.length;
}
