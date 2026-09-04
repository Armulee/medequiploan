/**
 * Applies the SQL files in drizzle/ in filename order.
 *
 * Exists so setting up a database needs nothing but Node — `psql` is not
 * installed by default on macOS, and pasting a migration into a web SQL editor
 * is easy to get half-right.
 *
 * Every migration is written to be safe to re-run (CREATE ... IF NOT EXISTS),
 * so this is idempotent.
 */
import './load-env';
import fs from 'fs/promises';
import path from 'path';
import { Client } from 'pg';

const url =
  process.env.DATABASE_URL ||
  process.env.POSTGRES_URL ||
  process.env.POSTGRES_PRISMA_URL ||
  process.env.DATABASE_URL_UNPOOLED ||
  process.env.POSTGRES_URL_NON_POOLING;

async function main() {
  if (!url) {
    throw new Error(
      'ไม่พบ connection string ของฐานข้อมูล — ตั้ง DATABASE_URL ใน .env.local ' +
        'หรือส่งมาทางบรรทัดคำสั่ง: DATABASE_URL="postgresql://..." npm run db:migrate'
    );
  }

  const dir = path.join(process.cwd(), 'drizzle');
  const files = (await fs.readdir(dir)).filter((f) => f.endsWith('.sql')).sort();
  if (files.length === 0) throw new Error('ไม่พบไฟล์ .sql ในโฟลเดอร์ drizzle/');

  // Neon (and most managed Postgres) require TLS; the CA is a public root, so
  // the default verification is fine.
  const client = new Client({
    connectionString: url,
    ssl: /localhost|127\.0\.0\.1/.test(url) ? undefined : { rejectUnauthorized: true },
  });
  await client.connect();

  try {
    for (const file of files) {
      const sql = await fs.readFile(path.join(dir, file), 'utf8');
      process.stdout.write(`  กำลังรัน ${file} ... `);
      await client.query(sql);
      console.log('เสร็จ');
    }
    const { rows } = await client.query(
      `SELECT count(*)::int AS n FROM information_schema.tables WHERE table_schema = 'public'`
    );
    console.log(`\n✅ migration เสร็จสิ้น · มี ${rows[0].n} ตารางในฐานข้อมูล`);
    console.log('   ขั้นถัดไป: npm run seed');
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error('\n❌ migration ล้มเหลว:', err instanceof Error ? err.message : err);
  process.exit(1);
});
