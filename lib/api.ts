import { NextResponse } from 'next/server';
import { currentUser, type SessionUser } from './session';

export class ApiError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

export function json(data: unknown, status = 200) {
  return NextResponse.json(data, { status });
}

export function errorResponse(err: unknown) {
  if (err instanceof ApiError) {
    return NextResponse.json({ error: err.message }, { status: err.status });
  }
  console.error(err);
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
