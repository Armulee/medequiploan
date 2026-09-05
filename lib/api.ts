import { NextResponse } from 'next/server';
import { currentUser, type SessionUser } from './session';

export class ApiError extends Error {
  status: number;
  /** Seconds until the caller may retry; sent as the Retry-After header. */
  retryAfterSeconds?: number;
  constructor(message: string, status = 400, retryAfterSeconds?: number) {
    super(message);
    this.status = status;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

/**
 * A required environment variable is missing or malformed.
 *
 * Separated from ApiError because it is an operator problem, not a caller
 * problem, and because hiding it behind the generic 500 made a misconfigured
 * deployment nearly impossible to diagnose from the outside — the symptom was
 * an unexplained 500 on the public form. The variable's name is safe to
 * surface; its value is never included.
 */
export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConfigError';
  }
}

export function json(data: unknown, status = 200) {
  return NextResponse.json(data, { status });
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
  const code = (err as { code?: string } | null)?.code;
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

  return NextResponse.json({ error: 'เกิดข้อผิดพลาดในระบบ (server error)' }, { status: 500 });
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
  const user = await currentUser();
  if (!user) throw new ApiError('ต้องเข้าสู่ระบบก่อนใช้งานส่วนนี้ (login required)', 401);
  return user;
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
