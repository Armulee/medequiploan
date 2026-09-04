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
