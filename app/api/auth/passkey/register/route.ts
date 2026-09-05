import { eq } from 'drizzle-orm';
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  type VerifiedRegistrationResponse,
} from '@simplewebauthn/server';
import { db } from '@/lib/db';
import { passkeys, users } from '@/lib/db/schema';
import { ApiError, json, requireAuth, route } from '@/lib/api';
import { logAction } from '@/lib/audit';
import { RP_NAME, origin, rpId, saveChallenge, takeChallenge } from '@/lib/webauthn';

/**
 * Step one of enrolling a passkey: options for the browser to sign.
 *
 * Only ever for the caller's own account — the id comes from the session, so
 * this cannot be pointed at somebody else's login.
 */
export const GET = route(async (req: Request) => {
  const user = await requireAuth();

  const existing = await db
    .select({ credentialId: passkeys.credentialId })
    .from(passkeys)
    .where(eq(passkeys.userId, user.user_id));

  const options = await generateRegistrationOptions({
    rpName: RP_NAME,
    rpID: rpId(req),
    userName: user.username,
    userDisplayName: user.name,
    // A stable id per account, so adding a second device adds to the same
    // passkey rather than creating a second identity in the browser's list.
    userID: new TextEncoder().encode(user.user_id),
    attestationType: 'none',
    // Refuse to enrol a device that is already enrolled, rather than silently
    // creating a duplicate the person cannot tell apart later.
    excludeCredentials: existing.map((c) => ({ id: c.credentialId })),
    authenticatorSelection: {
      residentKey: 'required', // discoverable: sign in without typing a username
      userVerification: 'required', // a face, a fingerprint or a PIN — not just a tap
    },
  });

  const challengeId = await saveChallenge(options.challenge, 'register', user.user_id);
  return json({ options, challenge_id: challengeId });
});

/** Step two: check what the authenticator signed and keep the public key. */
export const POST = route(async (req: Request) => {
  const user = await requireAuth();
  const body = (await req.json().catch(() => ({}))) as {
    challenge_id?: string;
    response?: Parameters<typeof verifyRegistrationResponse>[0]['response'];
    label?: string;
  };

  const stored = await takeChallenge(String(body.challenge_id ?? ''), 'register');
  if (!stored || stored.userId !== user.user_id) {
    throw new ApiError('คำขอสร้างพาสคีย์หมดอายุแล้ว กรุณาลองใหม่', 400);
  }
  if (!body.response) throw new ApiError('ข้อมูลพาสคีย์ไม่ครบ', 400);

  let verification: VerifiedRegistrationResponse;
  try {
    verification = await verifyRegistrationResponse({
      response: body.response,
      expectedChallenge: stored.challenge,
      expectedOrigin: origin(req),
      expectedRPID: rpId(req),
      requireUserVerification: true,
    });
  } catch (e) {
    throw new ApiError(e instanceof Error ? e.message : 'ยืนยันพาสคีย์ไม่สำเร็จ', 400);
  }

  const info = verification.registrationInfo;
  if (!verification.verified || !info) throw new ApiError('ยืนยันพาสคีย์ไม่สำเร็จ', 400);

  const label = String(body.label ?? '').trim().slice(0, 64) || 'อุปกรณ์ของฉัน';

  await db.insert(passkeys).values({
    userId: user.user_id,
    credentialId: info.credential.id,
    publicKey: Buffer.from(info.credential.publicKey).toString('base64url'),
    counter: info.credential.counter,
    deviceType: info.credentialDeviceType,
    backedUp: info.credentialBackedUp,
    label,
  });

  await logAction({
    actor: user,
    action: 'create_passkey',
    targetType: 'user',
    targetId: user.user_id,
    details: `${label} (${info.credentialDeviceType}${info.credentialBackedUp ? ', synced' : ''})`,
  });

  // Once an account holds a passkey its password stops being accepted for
  // sign-in, so make sure the row is what the next login will read.
  const [row] = await db.select().from(users).where(eq(users.userId, user.user_id));

  return json({ ok: true, passkeys: await countFor(user.user_id), username: row?.username });
});

async function countFor(userId: string): Promise<number> {
  const rows = await db
    .select({ id: passkeys.passkeyId })
    .from(passkeys)
    .where(eq(passkeys.userId, userId));
  return rows.length;
}
