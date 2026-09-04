/**
 * Applies the SQL files in drizzle/ in filename order.
 *
 * Exists so setting up a database needs nothing but Node — `psql` is not
 * installed by default on macOS, and pasting a migration into a web SQL editor
 * is easy to get half-right.
 *
 * Applied files are recorded in a _migrations ledger and skipped on later
 * runs, so this is safe to run repeatedly — the SQL that drizzle-kit generates
 * is not itself re-runnable (plain CREATE TABLE), so relying on the statements
 * alone would fail the second time.
 *
 * Each file runs inside a transaction: a migration that fails part way leaves
 * the database as it was rather than half-applied.
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
    await client.query(`
      CREATE TABLE IF NOT EXISTS _migrations (
        filename   text PRIMARY KEY,
        applied_at timestamptz NOT NULL DEFAULT now()
      )
    `);
    const { rows: done } = await client.query<{ filename: string }>('SELECT filename FROM _migrations');
    const applied = new Set(done.map((r) => r.filename));

    // A database migrated before this ledger existed already has the baseline
    // tables but no record of them. Adopt it rather than re-running the
    // baseline, which would fail on "relation already exists".
    if (applied.size === 0) {
      const { rows } = await client.query<{ exists: string | null }>(
        `SELECT to_regclass('public.users')::text AS exists`
      );
      if (rows[0]?.exists) {
        const baseline = files[0];
        await client.query('INSERT INTO _migrations (filename) VALUES ($1)', [baseline]);
        applied.add(baseline);
        console.log(`  พบตารางเดิมอยู่แล้ว — บันทึก ${baseline} ว่ารันไปแล้ว`);
      }
    }

    let ran = 0;
    for (const file of files) {
      if (applied.has(file)) {
        console.log(`  ข้าม ${file} (รันไปแล้ว)`);
        continue;
      }
      const sql = await fs.readFile(path.join(dir, file), 'utf8');
      process.stdout.write(`  กำลังรัน ${file} ... `);
      try {
        await client.query('BEGIN');
        await client.query(sql);
        await client.query('INSERT INTO _migrations (filename) VALUES ($1)', [file]);
        await client.query('COMMIT');
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      }
      console.log('เสร็จ');
      ran++;
    }
    if (ran === 0) console.log('  ไม่มี migration ใหม่');
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
