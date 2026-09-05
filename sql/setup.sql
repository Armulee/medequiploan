-- =====================================================================
--  ศูนย์ยืม-คืนกายอุปกรณ์ — ติดตั้งฐานข้อมูลทั้งหมดในไฟล์เดียว
-- =====================================================================
--
--  วิธีใช้ (ไม่ต้องลง Node หรือ psql):
--    1. เปิด Neon Console → เลือก project → เมนู "SQL Editor"
--    2. แก้รหัสผ่านสองบรรทัดในส่วนที่ 6 (ค้นหาคำว่า REPLACE-THIS)
--    3. ก๊อปไฟล์นี้ทั้งไฟล์ วางลงไป แล้วกด Run
--
--  ถ้ายังไม่แก้รหัสผ่าน ไฟล์จะหยุดและแจ้ง error ให้ ไม่สร้างบัญชีที่เดารหัสได้
--
--  ไฟล์นี้ = drizzle/0000 ถึง 0009 รวมกัน + สร้างบัญชีผู้ใช้ + อุปกรณ์ตัวอย่าง
--
--  **รันซ้ำได้ปลอดภัย** ทุกคำสั่งเป็น IF NOT EXISTS หรือเช็คก่อนเขียน
--  ถ้ามีข้อมูลอยู่แล้วจะไม่ทับ ไม่ลบ ไม่รีเซ็ตรหัสผ่านใคร
--
--  ไฟล์นี้ยังบันทึกลงตาราง _migrations ให้ด้วย เพราะฉะนั้นถ้าวันหลังมีคนรัน
--  `npm run db:migrate` จากเครื่องตัวเอง มันจะรู้ว่า 0000-0009 รันไปแล้ว
--  และข้ามให้ ไม่รันซ้ำจนพัง
-- =====================================================================


-- ---------------------------------------------------------------------
--  0. ส่วนขยายที่ต้องใช้
-- ---------------------------------------------------------------------
-- pgcrypto ใช้สร้าง bcrypt hash ของรหัสผ่านจากใน SQL ได้เลย
-- (ตรวจสอบแล้วว่า hash ที่ได้ ระบบฝั่ง Node อ่านได้ถูกต้อง)
CREATE EXTENSION IF NOT EXISTS pgcrypto;


-- ---------------------------------------------------------------------
--  1. ลำดับเลขสำหรับรหัสที่คนอ่านออก (B0001, E0001, ...)
--     ต้องมาก่อนตาราง เพราะตาราง DEFAULT มาจากมัน
-- ---------------------------------------------------------------------
CREATE SEQUENCE IF NOT EXISTS user_seq       START 1;
CREATE SEQUENCE IF NOT EXISTS borrower_seq   START 1;
CREATE SEQUENCE IF NOT EXISTS equipment_seq  START 1;
CREATE SEQUENCE IF NOT EXISTS record_seq     START 1;
CREATE SEQUENCE IF NOT EXISTS request_seq    START 1;
CREATE SEQUENCE IF NOT EXISTS audit_seq      START 1;
CREATE SEQUENCE IF NOT EXISTS adjustment_seq START 1;
CREATE SEQUENCE IF NOT EXISTS passkey_seq    START 1;


-- ---------------------------------------------------------------------
--  2. ตารางหลัก
-- ---------------------------------------------------------------------

-- เจ้าหน้าที่ · session_version ใช้ตัดทุกเครื่องที่ล็อกอินค้างไว้
-- (เปลี่ยนรหัสผ่าน / ปิดบัญชี / รีเซ็ตพาสคีย์ = บวกหนึ่ง)
CREATE TABLE IF NOT EXISTS "users" (
  "user_id"         varchar(16) PRIMARY KEY DEFAULT 'U' || lpad(nextval('user_seq')::text, 4, '0') NOT NULL,
  "username"        varchar(64) NOT NULL,
  "password_hash"   text NOT NULL,
  "role"            varchar(16) NOT NULL,          -- 'admin' | 'staff'
  "name"            varchar(128) NOT NULL,
  "active"          boolean DEFAULT true NOT NULL,
  "session_version" integer DEFAULT 1 NOT NULL,
  "created_at"      timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT "users_username_unique" UNIQUE("username")
);

-- ผู้ยืม · เลขบัตรประชาชนเก็บเป็น ciphertext (AES-256-GCM) เท่านั้น
-- ส่วน national_id_hash เป็น keyed hash ไว้ค้นหาแบบไม่ต้องถอดรหัสทั้งตาราง
-- anonymised_at = วันที่ลบข้อมูลส่วนบุคคลตามกำหนด PDPA (แถวยังอยู่ ประวัติยังอ่านได้)
CREATE TABLE IF NOT EXISTS "borrowers" (
  "borrower_id"         varchar(16) PRIMARY KEY DEFAULT 'B' || lpad(nextval('borrower_seq')::text, 4, '0') NOT NULL,
  "first_name"          varchar(128) NOT NULL,
  "last_name"           varchar(128) NOT NULL,
  "national_id_enc"     text NOT NULL,
  "national_id_hash"    varchar(64) NOT NULL,
  "address"             text NOT NULL,
  "phone"               varchar(20) DEFAULT '' NOT NULL,
  "line_id"             varchar(64) DEFAULT '' NOT NULL,
  "email"               varchar(254) DEFAULT '' NOT NULL,
  "consent_accepted_at" timestamptz,
  "consent_version"     varchar(16),
  "illness_photo_id"    varchar(64),
  "illness_description" text DEFAULT '' NOT NULL,
  "id_card_photo_id"    varchar(64),
  "registered_at"       timestamptz DEFAULT now() NOT NULL,
  "verified"            boolean DEFAULT false NOT NULL,
  "self_registered"     boolean DEFAULT false NOT NULL,
  "registered_by"       varchar(16),
  "anonymised_at"       timestamptz,
  CONSTRAINT "borrowers_national_id_hash_unique" UNIQUE("national_id_hash")
);

CREATE TABLE IF NOT EXISTS "equipment" (
  "equipment_id"        varchar(16) PRIMARY KEY DEFAULT 'E' || lpad(nextval('equipment_seq')::text, 4, '0') NOT NULL,
  "name"                varchar(256) NOT NULL,
  "category"            varchar(128) DEFAULT '' NOT NULL,
  "total_qty"           integer NOT NULL,
  "available_qty"       integer NOT NULL,
  "low_stock_threshold" integer DEFAULT 2 NOT NULL,
  "image_id"            varchar(256) DEFAULT '' NOT NULL
);

-- รายการยืม-คืน · การคืนคือการ UPDATE แถวเดิม ไม่ได้สร้างแถวใหม่
CREATE TABLE IF NOT EXISTS "records" (
  "record_id"           varchar(16) PRIMARY KEY DEFAULT 'R' || lpad(nextval('record_seq')::text, 4, '0') NOT NULL,
  "borrower_id"         varchar(16) NOT NULL,
  "equipment_id"        varchar(16) NOT NULL,
  "borrow_date"         timestamptz DEFAULT now() NOT NULL,
  "due_date"            timestamptz,
  "return_date"         timestamptz,
  "status"              varchar(32) DEFAULT 'ยืมอยู่' NOT NULL,
  "condition_on_return" text DEFAULT '' NOT NULL,
  "handled_by"          varchar(16),
  "handled_by_name"     varchar(128) DEFAULT '' NOT NULL,
  "received_by"         varchar(16),
  "received_by_name"    varchar(128) DEFAULT '' NOT NULL,
  "source"              varchar(16) DEFAULT 'direct' NOT NULL   -- 'direct' | 'request'
);

-- คำขอยืมจากฟอร์มสาธารณะ · contact_* คือสิ่งที่ "กรอกมาในคำขอนี้"
-- ซึ่งไม่ทับข้อมูลผู้ยืมในระบบ เจ้าหน้าที่ต้องตรวจกับรูปบัตรแล้วกดรับเอง
CREATE TABLE IF NOT EXISTS "requests" (
  "request_id"          varchar(16) PRIMARY KEY DEFAULT 'Q' || lpad(nextval('request_seq')::text, 4, '0') NOT NULL,
  "borrower_id"         varchar(16) NOT NULL,
  "equipment_id"        varchar(16) NOT NULL,
  "requested_at"        timestamptz DEFAULT now() NOT NULL,
  "status"              varchar(32) DEFAULT 'รอดำเนินการ' NOT NULL,
  "approved_by"         varchar(16),
  "record_id"           varchar(16),
  "note"                text DEFAULT '' NOT NULL,
  "contact_name"        varchar(256) DEFAULT '' NOT NULL,
  "contact_phone"       varchar(20) DEFAULT '' NOT NULL,
  "contact_line_id"     varchar(64) DEFAULT '' NOT NULL,
  "contact_email"       varchar(254) DEFAULT '' NOT NULL,
  "contact_address"     text DEFAULT '' NOT NULL,
  "id_card_photo_id"    varchar(64),
  "illness_photo_id"    varchar(64),
  "consent_accepted_at" timestamptz,
  "consent_version"     varchar(16)
);

CREATE TABLE IF NOT EXISTS "stock_adjustments" (
  "adjustment_id"    varchar(16) PRIMARY KEY DEFAULT 'S' || lpad(nextval('adjustment_seq')::text, 4, '0') NOT NULL,
  "equipment_id"     varchar(16) NOT NULL,
  "reason"           varchar(32) NOT NULL,
  "qty"              integer NOT NULL,
  "note"             text DEFAULT '' NOT NULL,
  "adjusted_by"      varchar(16) NOT NULL,
  "adjusted_by_name" varchar(128) NOT NULL,
  "at"               timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "audit_log" (
  "log_id"        varchar(16) PRIMARY KEY DEFAULT 'L' || lpad(nextval('audit_seq')::text, 4, '0') NOT NULL,
  "actor_user_id" varchar(16) DEFAULT 'public' NOT NULL,
  "actor_name"    varchar(128) NOT NULL,
  "action"        varchar(64) NOT NULL,
  "target_type"   varchar(32) NOT NULL,
  "target_id"     varchar(32) DEFAULT '' NOT NULL,
  "details"       text DEFAULT '' NOT NULL,
  "at"            timestamptz DEFAULT now() NOT NULL
);

-- ตัวนับ rate limit · เก็บใน Postgres เพราะ serverless แต่ละ instance
-- ไม่แชร์หน่วยความจำกัน นับในหน่วยความจำจึงกันอะไรไม่ได้เลย
CREATE TABLE IF NOT EXISTS "rate_limits" (
  "key"          varchar(200) PRIMARY KEY NOT NULL,
  "count"        integer DEFAULT 0 NOT NULL,
  "window_start" timestamptz DEFAULT now() NOT NULL
);

-- พาสคีย์ · เก็บเฉพาะ public key ฐานข้อมูลหลุดไปก็เอาไปล็อกอินแทนใครไม่ได้
CREATE TABLE IF NOT EXISTS "passkeys" (
  "passkey_id"    varchar(16) PRIMARY KEY DEFAULT ('K' || lpad(nextval('passkey_seq')::text, 4, '0')),
  "user_id"       varchar(16) NOT NULL REFERENCES "users"("user_id"),
  "credential_id" text NOT NULL UNIQUE,
  "public_key"    text NOT NULL,
  "counter"       integer DEFAULT 0 NOT NULL,
  "device_type"   varchar(32) DEFAULT '' NOT NULL,
  "backed_up"     boolean DEFAULT false NOT NULL,
  "label"         varchar(64) DEFAULT '' NOT NULL,
  "created_at"    timestamptz DEFAULT now() NOT NULL,
  "last_used_at"  timestamptz
);

-- challenge ของ WebAuthn · อยู่ในฐานข้อมูลเพราะ instance ที่ออก challenge
-- มักไม่ใช่ instance เดียวกับที่ตรวจคำตอบ
CREATE TABLE IF NOT EXISTS "webauthn_challenges" (
  "challenge_id" varchar(64) PRIMARY KEY,
  "challenge"    text NOT NULL,
  "user_id"      varchar(16),
  "purpose"      varchar(16) NOT NULL,   -- 'register' | 'login'
  "expires_at"   timestamptz NOT NULL
);


-- ---------------------------------------------------------------------
--  3. ความสัมพันธ์ระหว่างตาราง
--     ADD CONSTRAINT ไม่มี IF NOT EXISTS จึงต้องดักซ้ำเอง
-- ---------------------------------------------------------------------
DO $$
BEGIN
  ALTER TABLE "records" ADD CONSTRAINT "records_borrower_id_borrowers_borrower_id_fk"
    FOREIGN KEY ("borrower_id") REFERENCES "public"."borrowers"("borrower_id");
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "records" ADD CONSTRAINT "records_equipment_id_equipment_equipment_id_fk"
    FOREIGN KEY ("equipment_id") REFERENCES "public"."equipment"("equipment_id");
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "requests" ADD CONSTRAINT "requests_borrower_id_borrowers_borrower_id_fk"
    FOREIGN KEY ("borrower_id") REFERENCES "public"."borrowers"("borrower_id");
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "requests" ADD CONSTRAINT "requests_equipment_id_equipment_equipment_id_fk"
    FOREIGN KEY ("equipment_id") REFERENCES "public"."equipment"("equipment_id");
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "stock_adjustments" ADD CONSTRAINT "stock_adjustments_equipment_id_equipment_equipment_id_fk"
    FOREIGN KEY ("equipment_id") REFERENCES "public"."equipment"("equipment_id");
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;


-- ---------------------------------------------------------------------
--  4. Index
-- ---------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS "rate_limits_window_start_idx"      ON "rate_limits" ("window_start");
CREATE INDEX IF NOT EXISTS "borrowers_phone_idx"               ON "borrowers" ("phone");
CREATE INDEX IF NOT EXISTS "borrowers_anonymised_idx"          ON "borrowers" ("anonymised_at");
CREATE INDEX IF NOT EXISTS "passkeys_user_idx"                 ON "passkeys" ("user_id");
CREATE INDEX IF NOT EXISTS "webauthn_challenges_expiry_idx"    ON "webauthn_challenges" ("expires_at");


-- ---------------------------------------------------------------------
--  5. บันทึกว่า migration ไหนถูกรันไปแล้ว
--     สำคัญ: ถ้าไม่มีบรรทัดนี้ วันหลังใครรัน `npm run db:migrate`
--     มันจะพยายามรัน 0000 ใหม่แล้วพังทันที
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "_migrations" (
  "filename"   text PRIMARY KEY,
  "applied_at" timestamptz DEFAULT now() NOT NULL
);

INSERT INTO "_migrations" ("filename") VALUES
  ('0000_init.sql'),
  ('0001_rate_limits.sql'),
  ('0002_contact_and_consent.sql'),
  ('0003_email.sql'),
  ('0004_walker_name.sql'),
  ('0005_equipment_image.sql'),
  ('0006_session_version.sql'),
  ('0007_request_contact.sql'),
  ('0008_passkeys.sql'),
  ('0009_retention.sql')
ON CONFLICT ("filename") DO NOTHING;


-- ---------------------------------------------------------------------
--  6. สร้างบัญชีผู้ใช้   ← ***แก้รหัสผ่านสองบรรทัดล่างนี้ก่อนรัน***
-- ---------------------------------------------------------------------
--  รหัสผ่านนี้ใช้ล็อกอิน "ครั้งแรกครั้งเดียว" พอเข้าได้ ระบบจะบังคับสร้าง
--  พาสคีย์ทันที และหลังจากนั้นรหัสผ่านนี้จะใช้ล็อกอินไม่ได้อีกเลย
--
--  กติกา (ตรงกับที่ระบบบังคับตอนเปลี่ยนรหัสในหน้าเว็บ):
--    * อย่างน้อย 12 ตัวอักษร
--    * ห้ามมีคำว่า admin / staff อยู่ในรหัส
--    * ห้ามเป็นตัวเดียวกันซ้ำ ๆ หรือเรียงกัน (aaaa..., 1234...)
--
--  ถ้ายังไม่แก้ หรือรหัสไม่ผ่านกติกา ไฟล์นี้จะ **หยุดและแจ้ง error**
--  ไม่สร้างบัญชีให้ — กันไม่ให้มีบัญชีที่ใช้รหัสตัวอย่างซึ่งเปิดเผยอยู่ใน git
--
--  ใช้ DO block แทนตัวแปรของ psql (\set) เพราะ SQL editor บนเว็บอย่าง Neon
--  ไม่รองรับคำสั่งของ psql — แบบนี้ก๊อปวางได้ทุกที่
--
DO $$
DECLARE
  -- ↓↓↓ แก้สองบรรทัดนี้ ↓↓↓
  admin_password text := 'REPLACE-THIS-BEFORE-RUNNING';
  staff_password text := 'REPLACE-THIS-TOO-BEFORE-RUN';
  -- ↑↑↑ แก้สองบรรทัดนี้ ↑↑↑
  pw    text;
  who   text;
BEGIN
  FOREACH pw IN ARRAY ARRAY[admin_password, staff_password] LOOP
    who := CASE WHEN pw = admin_password THEN 'admin' ELSE 'staff' END;

    IF pw LIKE 'REPLACE-THIS%' THEN
      RAISE EXCEPTION
        'ยังไม่ได้แก้รหัสผ่านของ % — เลื่อนขึ้นไปที่ส่วนที่ 6 แล้วใส่รหัสจริงก่อนรัน', who;
    END IF;
    IF length(pw) < 12 THEN
      RAISE EXCEPTION 'รหัสผ่านของ % สั้นเกินไป (ต้องอย่างน้อย 12 ตัวอักษร)', who;
    END IF;
    IF pw ILIKE '%admin%' OR pw ILIKE '%staff%' THEN
      RAISE EXCEPTION 'รหัสผ่านของ % ห้ามมีคำว่า admin หรือ staff อยู่ในนั้น', who;
    END IF;
    IF pw ~ '^(.)\1+$' THEN
      RAISE EXCEPTION 'รหัสผ่านของ % เป็นตัวอักษรเดียวกันซ้ำทั้งหมด', who;
    END IF;
  END LOOP;

  IF admin_password = staff_password THEN
    RAISE EXCEPTION 'รหัสผ่านของ admin กับ staff ต้องไม่เหมือนกัน';
  END IF;

  -- มีอยู่แล้วก็ไม่แตะ — รันซ้ำไม่รีเซ็ตรหัสผ่านของใคร
  INSERT INTO "users" ("username", "password_hash", "role", "name")
  SELECT 'admin', crypt(admin_password, gen_salt('bf', 10)), 'admin', 'ผู้ดูแลระบบ'
  WHERE NOT EXISTS (SELECT 1 FROM "users" WHERE "username" = 'admin');

  INSERT INTO "users" ("username", "password_hash", "role", "name")
  SELECT 'staff', crypt(staff_password, gen_salt('bf', 10)), 'staff', 'เจ้าหน้าที่ตัวอย่าง'
  WHERE NOT EXISTS (SELECT 1 FROM "users" WHERE "username" = 'staff');
END $$;


-- ---------------------------------------------------------------------
--  7. อุปกรณ์ตัวอย่าง (ลบทิ้งได้ทีหลังจากหน้าเจ้าหน้าที่)
--     ใส่ให้เฉพาะตอนที่ยังไม่มีอุปกรณ์เลย
-- ---------------------------------------------------------------------
INSERT INTO "equipment" ("name", "category", "total_qty", "available_qty", "low_stock_threshold")
SELECT * FROM (VALUES
  ('วีลแชร์ (Wheelchair)',                    'เคลื่อนที่',   10, 10, 2),
  ('ไม้ค้ำยัน (Crutches)',                     'เคลื่อนที่',   20, 20, 4),
  ('เตียงผู้ป่วยไฟฟ้า (Electric Bed)',          'เตียง/ที่นอน',  5,  5, 1),
  ('เครื่องผลิตออกซิเจน (Oxygen Concentrator)', 'ระบบหายใจ',    6,  6, 2),
  ('โครงเหล็กช่วยเดิน (Walker)',                'เคลื่อนที่',   15, 15, 3)
) AS seed(name, category, total_qty, available_qty, low_stock_threshold)
WHERE NOT EXISTS (SELECT 1 FROM "equipment");


-- ---------------------------------------------------------------------
--  เสร็จแล้ว — ตรวจผล
-- ---------------------------------------------------------------------
SELECT
  (SELECT count(*) FROM information_schema.tables
     WHERE table_schema = 'public')            AS "ตารางทั้งหมด",
  (SELECT count(*) FROM "users")               AS "บัญชีเจ้าหน้าที่",
  (SELECT count(*) FROM "equipment")           AS "อุปกรณ์",
  (SELECT count(*) FROM "_migrations")         AS "migration_ที่บันทึกไว้";

-- ควรได้: ตาราง 11 · บัญชี 2 · อุปกรณ์ 5 · migration 10
--
-- ขั้นถัดไป: เข้า /staff ด้วย username `admin` และรหัสผ่านที่ตั้งไว้ข้างบน
--            ระบบจะบังคับสร้างพาสคีย์ทันที และหลังจากนั้นรหัสผ่านนี้
--            จะใช้ล็อกอินไม่ได้อีก (กันฟิชชิ่ง) — อ่าน DEPLOY.md ประกอบ
