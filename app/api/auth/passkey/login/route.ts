import { eq } from 'drizzle-orm';
import {
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from '@simplewebauthn/server';
import { db } from '@/lib/db';
import { passkeys, users } from '@/lib/db/schema';
import { ApiError, json, route } from '@/lib/api';
import { logAction } from '@/lib/audit';
import { RULES, clientIp, hit, reset, sweepExpired, tooManyRequests } from '@/lib/rate-limit';
import { saveSession, type SessionUser } from '@/lib/session';
import { origin, rpId, saveChallenge, takeChallenge } from '@/lib/webauthn';

/**
 * Step one of signing in with a passkey.
 *
 * No username is asked for and none is sent: the credentials are discoverable,
 * so the authenticator offers the accounts it holds for this site and the
 * browser returns which one was chosen. That also means this endpoint reveals
 * nothing — it cannot be used to ask whether an account exists.
 */
export const GET = route(async (req: Request) => {
  const options = await generateAuthenticationOptions({
    rpID: rpId(req),
    userVerification: 'required',
  });
  const challengeId = await saveChallenge(options.challenge, 'login', null);
  return json({ options, challenge_id: challengeId });
});

/** Step two: verify the signature, and sign in whoever it belongs to. */
export const POST = route(async (req: Request) => {
  void sweepExpired();

  // Passkeys cannot be guessed, but the endpoint still costs a database read
  // and a signature check, so it is throttled per address. Loosely, and only
  // on failures (see the reset below): a clinic full of staff shares one
  // address, and the password bucket's twenty per quarter hour would lock the
  // whole office out of a credential nobody can brute force anyway.
  const ip = clientIp(req);
  const ipKey = `passkey:ip:${ip}`;
  const limit = await hit(ipKey, RULES.passkeyPerIp);
  if (!limit.allowed) throw tooManyRequests(limit.retryAfterSeconds);

  const body = (await req.json().catch(() => ({}))) as {
    challenge_id?: string;
    response?: Parameters<typeof verifyAuthenticationResponse>[0]['response'];
  };

  const stored = await takeChallenge(String(body.challenge_id ?? ''), 'login');
  if (!stored) throw new ApiError('คำขอเข้าสู่ระบบหมดอายุแล้ว กรุณาลองใหม่', 400);
  if (!body.response?.id) throw new ApiError('ข้อมูลพาสคีย์ไม่ครบ', 400);

  const [credential] = await db
    .select()
    .from(passkeys)
    .where(eq(passkeys.credentialId, body.response.id));
  if (!credential) throw new ApiError('ไม่พบพาสคีย์นี้ในระบบ', 401);

  const [account] = await db.select().from(users).where(eq(users.userId, credential.userId));
  if (!account || !account.active) {
    throw new ApiError('บัญชีนี้ถูกปิดการใช้งานแล้ว กรุณาติดต่อผู้ดูแลระบบ', 401);
  }

  let verification;
  try {
    verification = await verifyAuthenticationResponse({
      response: body.response,
      expectedChallenge: stored.challenge,
      expectedOrigin: origin(req),
      expectedRPID: rpId(req),
      requireUserVerification: true,
      credential: {
        id: credential.credentialId,
        publicKey: new Uint8Array(Buffer.from(credential.publicKey, 'base64url')),
        counter: credential.counter,
      },
    });
  } catch (e) {
    throw new ApiError(e instanceof Error ? e.message : 'ยืนยันพาสคีย์ไม่สำเร็จ', 401);
  }

  if (!verification.verified) throw new ApiError('ยืนยันพาสคีย์ไม่สำเร็จ', 401);

  // Synced passkeys leave the counter at zero forever, so a counter that has
  // not moved proves nothing and must not be treated as a cloned key. Where a
  // device does keep one, going backwards is worth recording.
  const next = verification.authenticationInfo.newCounter;
  if (credential.counter > 0 && next <= credential.counter) {
    await logAction({
      actor: null,
      action: 'passkey_counter_stall',
      targetType: 'user',
      targetId: account.userId,
      details: `credential=${credential.passkeyId} stored=${credential.counter} got=${next}`,
    });
  }

  await db
    .update(passkeys)
    .set({ counter: next, lastUsedAt: new Date() })
    .where(eq(passkeys.passkeyId, credential.passkeyId));

  const user: SessionUser = {
    user_id: account.userId,
    username: account.username,
    role: account.role as SessionUser['role'],
    name: account.name,
  };
  await saveSession(user, account.sessionVersion);

  // Only failures count. Staff signing in and out through the day must never
  // throttle themselves out of their own system.
  await reset(ipKey);

  await logAction({
    actor: user,
    action: 'login_passkey',
    targetType: 'user',
    targetId: user.user_id,
    details: credential.label,
  });

  return json({ user });
});
