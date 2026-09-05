import { NextResponse } from 'next/server';
import { requireActiveUser } from './auth';
import type { SessionUser } from './session';
import { ApiError, ConfigError } from './errors';

// Re-exported so the many `import { ApiError } from '@/lib/api'` call sites
// keep working; the definitions live in ./errors to keep lib/db out of a cycle.
export { ApiError, ConfigError };

export function json(data: unknown, status = 200) {
  return NextResponse.json(data, { status });
}

/** What one page of a list looks like on the wire. */
export type Page = { limit: number; offset: number };

/**
 * Read ?limit and ?offset for a list endpoint.
 *
 * Returns null when no limit was asked for, and the caller then answers with
 * the whole list: the equipment selects, the public landing page and the
 * dashboard all read these endpoints and want everything. Only the staff
 * lists page, and they always send a limit.
 */
/**
 * The same, but a page is always returned — a caller that sends no limit gets
 * the default one instead of the whole table.
 *
 * For lists of people this is the difference between "the UI forgot a
 * parameter" and "one compromised staff account exports every borrower,
 * every loan and every ID-card URL in a single request". The endpoints that
 * genuinely need everything (the equipment catalogue behind the selects and
 * the public landing page) keep using pageParams.
 */
export function requiredPage(sp: URLSearchParams, max = 100, fallback = 50): Page {
  return pageParams(sp, max) ?? { limit: fallback, offset: 0 };
}

export function pageParams(sp: URLSearchParams, max = 100): Page | null {
  const raw = sp.get('limit');
  if (raw === null) return null;

  const asked = Number.parseInt(raw, 10);
  const limit = Number.isFinite(asked) && asked > 0 ? Math.min(asked, max) : 20;
  const offsetAsked = Number.parseInt(sp.get('offset') ?? '0', 10);
  const offset = Number.isFinite(offsetAsked) && offsetAsked > 0 ? offsetAsked : 0;
  return { limit, offset };
}

export function errorResponse(err: unknown) {
  if (err instanceof ApiError) {
    const headers = err.retryAfterSeconds
      ? { 'Retry-After': String(err.retryAfterSeconds) }
      : undefined;
    return NextResponse.json({ error: err.message }, { status: err.status, headers });
  }
  console.error(err);
  if (err instanceof ConfigError) {
    return NextResponse.json(
      { error: `ระบบยังตั้งค่าไม่ครบ: ${err.message}`, code: 'CONFIG' },
      { status: 500 }
    );
  }
  // A migration that has not been run turns every query touching the changed
  // table into a generic 500, which is indistinguishable from a bug — one
  // shipped column cost a round of "approve says error but it approved". Say
  // what it is instead: the write had already happened, only the read back
  // failed.
  const code = causeCode(err);
  if (code === '42703' || code === '42P01') {
    return NextResponse.json(
      {
        error:
          'ฐานข้อมูลยังไม่ตรงกับโค้ดเวอร์ชันนี้ (ยังไม่ได้รัน migration) ' +
          'ให้ผู้ดูแลระบบรัน: npm run db:migrate',
        code: 'SCHEMA',
      },
      { status: 500 }
    );
  }

  // Storage is the other thing that fails only once deployed, and "server
  // error" sends whoever is holding the phone looking in the wrong place.
  const storage = storageProblem(err);
  if (storage) {
    return NextResponse.json({ error: storage, code: 'STORAGE' }, { status: 500 });
  }

  return NextResponse.json({ error: 'เกิดข้อผิดพลาดในระบบ (server error)' }, { status: 500 });
}

/**
 * Find a Postgres error code anywhere in the chain.
 *
 * Reading `err.code` off the top only worked for an error thrown by the driver
 * directly. Drizzle wraps a failed query in its own error and keeps the real
 * one on `cause`, so the schema-mismatch branch above never fired — a missing
 * migration reported itself as a plain "server error", which is exactly the
 * message it was written to replace.
 */
function causeCode(err: unknown): string | undefined {
  for (let e = err, depth = 0; e && depth < 5; e = (e as { cause?: unknown }).cause, depth++) {
    const code = (e as { code?: unknown }).code;
    if (typeof code === 'string') return code;
  }
  return undefined;
}

/** Whether this is the blob store refusing, and what to say about it. */
function storageProblem(err: unknown): string | null {
  const names: string[] = [];
  for (let e = err, depth = 0; e && depth < 5; e = (e as { cause?: unknown }).cause, depth++) {
    const n = (e as { name?: unknown }).name;
    const m = (e as { message?: unknown }).message;
    if (typeof n === 'string') names.push(n);
    if (typeof m === 'string') names.push(m);
  }
  const text = names.join(' ');
  if (!/Blob|blob/.test(text)) return null;

  // The store is there but will not take the write — almost always a store
  // that has not been connected to this deployment, or a token that no longer
  // matches it. Say which of the two so it is a five-minute fix.
  if (/Access denied|not authorized|token|Unauthorized|store not found|BlobStoreNotFound/i.test(text)) {
    return (
      'อัปโหลดไม่สำเร็จ: เข้าถึง Blob store ไม่ได้ ' +
      'ให้ผู้ดูแลตรวจว่า Blob store ถูก connect กับ project นี้แล้ว แล้ว redeploy หนึ่งครั้ง'
    );
  }
  return `อัปโหลดไม่สำเร็จ: ที่เก็บไฟล์ตอบกลับมาว่า ${text.slice(0, 160)}`;
}

type Handler<C> = (req: Request, ctx: C) => Promise<Response>;

// Wraps every route so a thrown error becomes a JSON response. In the Express
// version an error thrown inside an async handler escaped as an unhandled
// rejection, which on Node 20+ kills the process — one bad request took the
// whole server down. Here the worst case is a single 500.
export function route<C>(handler: Handler<C>): Handler<C> {
  return async (req, ctx) => {
    try {
      return await handler(req, ctx);
    } catch (err) {
      return errorResponse(err);
    }
  };
}

export async function requireAuth(): Promise<SessionUser> {
  return requireActiveUser();
}

export async function requireRole(...roles: Array<SessionUser['role']>): Promise<SessionUser> {
  const user = await requireAuth();
  if (!roles.includes(user.role)) {
    throw new ApiError('ไม่มีสิทธิ์เข้าถึง (insufficient permissions)', 403);
  }
  return user;
}

/**
 * Read a request body that may arrive as JSON or as multipart — the same
 * endpoint has to serve a form with a file and a form without one, and asking
 * every caller to send multipart just to change a name would be worse.
 * Returns the scalar fields plus whichever files came with them.
 */
export async function bodyOrForm(
  req: Request
): Promise<{ fields: Record<string, unknown>; files: Record<string, File> }> {
  const type = req.headers.get('content-type') ?? '';
  if (!type.includes('multipart/form-data')) {
    return { fields: ((await req.json().catch(() => ({}))) as Record<string, unknown>), files: {} };
  }

  const form = await req.formData();
  const fields: Record<string, unknown> = {};
  const files: Record<string, File> = {};
  for (const [key, value] of form.entries()) {
    if (value instanceof File) {
      if (value.size > 0) files[key] = value;
    } else {
      fields[key] = value;
    }
  }
  return { fields, files };
}
