/**
 * Creates the initial users and sample equipment. Safe to run repeatedly.
 *
 * Unlike the JSON version this is NOT wired into app startup. On serverless the
 * old code re-seeded on every cold start, which both burned ~200ms hashing
 * passwords before it could answer a request and kept resurrecting the default
 * admin account.
 */
import './load-env';
import bcrypt from 'bcryptjs';
import { db } from '../lib/db';
import { equipment, users } from '../lib/db/schema';
import { MIN_PASSWORD } from '../lib/password';

async function main() {
  const existingUsers = await db.select().from(users).limit(1);
  if (existingUsers.length === 0) {
    const adminPass = process.env.SEED_ADMIN_PASSWORD;
    const staffPass = process.env.SEED_STAFF_PASSWORD;
    if (
      !adminPass ||
      !staffPass ||
      adminPass.length < MIN_PASSWORD ||
      staffPass.length < MIN_PASSWORD
    ) {
      throw new Error(
        `ตั้ง SEED_ADMIN_PASSWORD และ SEED_STAFF_PASSWORD ใน .env ก่อน (อย่างน้อย ${MIN_PASSWORD} ตัวอักษร) ` +
          'ระบบไม่มีรหัสผ่านเริ่มต้นให้แล้ว เพื่อไม่ให้มีบัญชีที่เดารหัสได้หลุดขึ้น production'
      );
    }

    await db.insert(users).values([
      {
        username: 'admin',
        passwordHash: bcrypt.hashSync(adminPass, 10),
        role: 'admin',
        name: 'ผู้ดูแลระบบ',
      },
      {
        username: 'staff',
        passwordHash: bcrypt.hashSync(staffPass, 10),
        role: 'staff',
        name: 'เจ้าหน้าที่ตัวอย่าง',
      },
    ]);
    console.log('สร้างผู้ใช้เริ่มต้นแล้ว: admin, staff');
  } else {
    console.log('มีผู้ใช้อยู่แล้ว ข้ามการสร้างผู้ใช้');
  }

  const existingEquipment = await db.select().from(equipment).limit(1);
  if (existingEquipment.length === 0) {
    await db.insert(equipment).values([
      { name: 'วีลแชร์ (Wheelchair)', category: 'เคลื่อนที่', totalQty: 10, availableQty: 10, lowStockThreshold: 2 },
      { name: 'ไม้ค้ำยัน (Crutches)', category: 'เคลื่อนที่', totalQty: 20, availableQty: 20, lowStockThreshold: 4 },
      { name: 'เตียงผู้ป่วยไฟฟ้า (Electric Bed)', category: 'เตียง/ที่นอน', totalQty: 5, availableQty: 5, lowStockThreshold: 1 },
      { name: 'เครื่องผลิตออกซิเจน (Oxygen Concentrator)', category: 'ระบบหายใจ', totalQty: 6, availableQty: 6, lowStockThreshold: 2 },
      { name: 'โครงเหล็กช่วยเดิน (Walker)', category: 'เคลื่อนที่', totalQty: 15, availableQty: 15, lowStockThreshold: 3 },
    ]);
    console.log('สร้างอุปกรณ์ตัวอย่างแล้ว 5 รายการ');
  } else {
    console.log('มีอุปกรณ์อยู่แล้ว ข้ามการสร้างอุปกรณ์');
  }

  console.log('Seed เสร็จสิ้น');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
