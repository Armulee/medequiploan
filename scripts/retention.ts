/**
 * The retention sweep, from a terminal.
 *
 * The same code Vercel Cron runs weekly, for the two times a person needs it:
 * checking what the schedule is about to delete before trusting it, and
 * running it by hand for an audit or a subject's deletion request.
 *
 *   npm run retention:preview        # says what would go, changes nothing
 *   npm run retention:run -- --yes   # actually removes it, irreversibly
 *
 * The `--yes` is the second step the project asks for on anything hard to
 * undo. Without it the command prints what it would delete and stops, so
 * running it from muscle memory or a stray shell history entry cannot destroy
 * anybody's records.
 */
import './load-env';
import { RETENTION_DAYS, runRetention } from '../lib/retention';

async function main() {
  const confirmed = process.argv.includes('--yes');
  const dryRun = process.argv.includes('--dry') || !confirmed;
  const daysArg = process.argv.find((a) => a.startsWith('--days='));
  const days = daysArg ? Number(daysArg.split('=')[1]) : RETENTION_DAYS;

  if (!Number.isFinite(days) || days < 1) {
    console.error('❌ --days ต้องเป็นจำนวนวันที่มากกว่า 0');
    process.exit(1);
  }

  const result = await runRetention({ days, dryRun });

  console.log(
    `\nนโยบาย: ลบข้อมูลส่วนบุคคลหลังไม่มีการยืม ${days} วัน (${(days / 365).toFixed(1)} ปี)`
  );

  if (result.scanned === 0) {
    console.log('✅ ยังไม่มีใครเข้าเกณฑ์ ไม่ต้องทำอะไร');
    process.exit(0);
  }

  if (dryRun) {
    console.log(`\n🔍 ตรวจสอบอย่างเดียว — ยังไม่ได้ลบอะไรเลย`);
    console.log(`   เข้าเกณฑ์ ${result.scanned} ราย: ${result.anonymised.join(', ')}`);
    console.log(`\n   จะถูกลบ: ชื่อ-นามสกุล เลขบัตรประชาชน ที่อยู่ เบอร์โทร LINE อีเมล`);
    console.log(`   ข้อมูลอาการป่วย และรูปภาพทั้งหมด (ทั้งไฟล์จริง ไม่ใช่แค่ลิงก์)`);
    console.log(`   จะเหลือ: รหัสผู้ยืม วันลงทะเบียน และประวัติการยืม-คืน ซึ่งระบุตัวใครไม่ได้`);
    console.log(`\n   ถ้าถูกต้องแล้ว สั่งลบจริงด้วย: npm run retention:run -- --yes`);
    console.log('   *** ลบแล้วกู้คืนไม่ได้ไม่ว่าวิธีใด ***');
    process.exit(0);
  }

  console.log(`\n🗑️  ลบข้อมูลส่วนบุคคลของ ${result.anonymised.length} ราย`);
  console.log(`   ${result.anonymised.join(', ')}`);
  console.log(`   ลบรูปภาพ ${result.photosDeleted} ไฟล์`);
  console.log('\n✅ เสร็จแล้ว · ประวัติการยืม-คืนและ audit log ยังอยู่ครบ แต่ระบุตัวบุคคลไม่ได้แล้ว');
}

void main();
