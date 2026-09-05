/**
 * Delete the uploaded files: ID cards, illness photographs, catalogue pictures.
 *
 * The SQL reset cannot do this. Photographs live in Vercel Blob and the
 * database only holds their names, so wiping the database alone leaves a store
 * full of photographs of real people's ID cards with nothing left to say whose
 * they are — the worst of both worlds before handing the store to somebody
 * else.
 *
 *   npm run wipe-blob            # says what would go, deletes nothing
 *   npm run wipe-blob -- --yes   # actually deletes
 *
 * The --yes is the second step this project asks for on anything hard to undo.
 */
import './load-env';
import { del, list } from '@vercel/blob';

const FOLDERS = ['id_cards/', 'illness_photos/', 'equipment/'] as const;

async function main() {
  const confirmed = process.argv.includes('--yes');

  if (!process.env.BLOB_READ_WRITE_TOKEN && !process.env.BLOB_STORE_ID) {
    console.error(
      '❌ ไม่พบ Blob store — ตั้ง BLOB_READ_WRITE_TOKEN หรือ BLOB_STORE_ID ก่อน\n' +
        '   (ดึงมาจาก Vercel: `vercel env pull .env.local`)'
    );
    process.exit(1);
  }

  // Collect first, delete after, so a listing that fails part way cannot leave
  // the store half-cleared with no record of what went.
  const found: Record<string, string[]> = {};
  let total = 0;

  for (const prefix of FOLDERS) {
    const paths: string[] = [];
    let cursor: string | undefined;
    do {
      const page = await list({ prefix, cursor, limit: 1000 });
      paths.push(...page.blobs.map((b) => b.pathname));
      cursor = page.hasMore ? page.cursor : undefined;
    } while (cursor);
    found[prefix] = paths;
    total += paths.length;
  }

  console.log('\nไฟล์ใน Blob store:');
  for (const prefix of FOLDERS) {
    console.log(`  ${prefix.padEnd(18)} ${found[prefix].length} ไฟล์`);
  }

  if (total === 0) {
    console.log('\n✅ ไม่มีไฟล์ให้ลบ');
    return;
  }

  if (!confirmed) {
    console.log(`\n🔍 ตรวจสอบอย่างเดียว — ยังไม่ได้ลบอะไรเลย (${total} ไฟล์)`);
    console.log('   สั่งลบจริงด้วย: npm run wipe-blob -- --yes');
    console.log('   *** ลบแล้วกู้คืนไม่ได้ รูปบัตรประชาชนหายถาวร ***');
    return;
  }

  // del() takes up to a few hundred at a time; chunk rather than assume.
  const all = FOLDERS.flatMap((p) => found[p]);
  let done = 0;
  for (let i = 0; i < all.length; i += 100) {
    const chunk = all.slice(i, i + 100);
    await del(chunk);
    done += chunk.length;
    process.stdout.write(`\r  ลบแล้ว ${done}/${all.length}`);
  }

  console.log(`\n\n✅ ลบไฟล์ทั้งหมด ${done} ไฟล์`);
  console.log('   อย่าลืมล้างฐานข้อมูลด้วย (sql/reset.sql) ไม่งั้นจะเหลือชื่อไฟล์ที่ชี้ไปที่ว่าง');
}

main().catch((err) => {
  console.error('\n❌ ลบไม่สำเร็จ:', err instanceof Error ? err.message : err);
  process.exit(1);
});
