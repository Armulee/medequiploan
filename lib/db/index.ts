import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import * as schema from './schema';

// Neon's HTTP driver instead of a TCP pool: each serverless invocation makes a
// stateless HTTP call, so concurrent functions can't exhaust Postgres'
// connection limit the way a per-instance pg.Pool would.
if (!process.env.DATABASE_URL) {
  throw new Error(
    'ไม่พบ DATABASE_URL — ตั้งค่าใน .env (dev) หรือ Vercel Project Settings (production)'
  );
}

const sql = neon(process.env.DATABASE_URL);

export const db = drizzle(sql, { schema });
export { schema };
