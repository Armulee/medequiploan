ALTER TABLE "borrowers" ADD COLUMN IF NOT EXISTS "phone" varchar(20) DEFAULT '' NOT NULL;
ALTER TABLE "borrowers" ADD COLUMN IF NOT EXISTS "line_id" varchar(64) DEFAULT '' NOT NULL;
ALTER TABLE "borrowers" ADD COLUMN IF NOT EXISTS "consent_accepted_at" timestamp with time zone;
ALTER TABLE "borrowers" ADD COLUMN IF NOT EXISTS "consent_version" varchar(16);

-- Finding a borrower by the number they called from is a common desk task.
CREATE INDEX IF NOT EXISTS "borrowers_phone_idx" ON "borrowers" ("phone");
