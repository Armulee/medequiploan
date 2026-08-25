import { neon } from '@neondatabase/serverless';
import { drizzle as drizzleNeon, type NeonHttpDatabase } from 'drizzle-orm/neon-http';
import { drizzle as drizzlePg } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';

// Vercel's Neon/Postgres integrations inject the connection string under
// different names depending on which one the store was created from, so accept
// any of them rather than failing to boot on a deploy that is actually wired up
// correctly. DATABASE_URL wins when it is set explicitly.
//
// Prefer the POOLED string: the serverless driver opens a connection per
// invocation, and the unpooled endpoint will run out under concurrency.
const url =
  process.env.DATABASE_URL ||
  process.env.POSTGRES_URL ||
  process.env.POSTGRES_PRISMA_URL ||
  process.env.DATABASE_URL_UNPOOLED ||
  process.env.POSTGRES_URL_NON_POOLING;

if (!url) {
  throw new Error(
    'ไม่พบ connection string ของฐานข้อมูล — ตั้ง DATABASE_URL ใน .env.local (dev) ' +
      'หรือเชื่อม Neon store เข้ากับ project ใน Vercel (production)'
  );
}

// Neon in production, plain node-postgres when pointed at a local server, so
// `npm run dev` works against a Postgres on your own machine without any code
// change. Neon's HTTP driver is deliberate: each serverless invocation makes a
// stateless call, so concurrent functions can't exhaust the connection limit
// the way a per-instance TCP pool would.
const isNeon = /\.neon\.tech|\.neon\.build/.test(url) || process.env.DB_DRIVER === 'neon';

export const db = (
  isNeon
    ? drizzleNeon(neon(url), { schema })
    : drizzlePg(new Pool({ connectionString: url }), { schema })
) as unknown as NeonHttpDatabase<typeof schema>;

/**
 * `db.execute()` hands back `{ rows }` on node-postgres but an array-like on
 * neon-http. Normalise so callers don't have to care which driver is live.
 */
export function rowsOf<T>(result: unknown): T[] {
  if (Array.isArray(result)) return result as T[];
  const rows = (result as { rows?: unknown })?.rows;
  return Array.isArray(rows) ? (rows as T[]) : [];
}

export { schema };
