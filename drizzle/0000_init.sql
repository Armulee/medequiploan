-- ID sequences backing the human-readable keys (B0001, E0001, ...).
-- These must exist before the tables that DEFAULT from them.
CREATE SEQUENCE IF NOT EXISTS user_seq START 1;
CREATE SEQUENCE IF NOT EXISTS borrower_seq START 1;
CREATE SEQUENCE IF NOT EXISTS equipment_seq START 1;
CREATE SEQUENCE IF NOT EXISTS record_seq START 1;
CREATE SEQUENCE IF NOT EXISTS request_seq START 1;
CREATE SEQUENCE IF NOT EXISTS audit_seq START 1;
CREATE SEQUENCE IF NOT EXISTS adjustment_seq START 1;

CREATE TABLE "audit_log" (
	"log_id" varchar(16) PRIMARY KEY DEFAULT 'L' || lpad(nextval('audit_seq')::text, 4, '0') NOT NULL,
	"actor_user_id" varchar(16) DEFAULT 'public' NOT NULL,
	"actor_name" varchar(128) NOT NULL,
	"action" varchar(64) NOT NULL,
	"target_type" varchar(32) NOT NULL,
	"target_id" varchar(32) DEFAULT '' NOT NULL,
	"details" text DEFAULT '' NOT NULL,
	"at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "borrowers" (
	"borrower_id" varchar(16) PRIMARY KEY DEFAULT 'B' || lpad(nextval('borrower_seq')::text, 4, '0') NOT NULL,
	"first_name" varchar(128) NOT NULL,
	"last_name" varchar(128) NOT NULL,
	"national_id_enc" text NOT NULL,
	"national_id_hash" varchar(64) NOT NULL,
	"address" text NOT NULL,
	"illness_photo_id" varchar(64),
	"illness_description" text DEFAULT '' NOT NULL,
	"id_card_photo_id" varchar(64),
	"registered_at" timestamp with time zone DEFAULT now() NOT NULL,
	"verified" boolean DEFAULT false NOT NULL,
	"self_registered" boolean DEFAULT false NOT NULL,
	"registered_by" varchar(16),
	CONSTRAINT "borrowers_national_id_hash_unique" UNIQUE("national_id_hash")
);
--> statement-breakpoint
CREATE TABLE "equipment" (
	"equipment_id" varchar(16) PRIMARY KEY DEFAULT 'E' || lpad(nextval('equipment_seq')::text, 4, '0') NOT NULL,
	"name" varchar(256) NOT NULL,
	"category" varchar(128) DEFAULT '' NOT NULL,
	"total_qty" integer NOT NULL,
	"available_qty" integer NOT NULL,
	"low_stock_threshold" integer DEFAULT 2 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "records" (
	"record_id" varchar(16) PRIMARY KEY DEFAULT 'R' || lpad(nextval('record_seq')::text, 4, '0') NOT NULL,
	"borrower_id" varchar(16) NOT NULL,
	"equipment_id" varchar(16) NOT NULL,
	"borrow_date" timestamp with time zone DEFAULT now() NOT NULL,
	"due_date" timestamp with time zone,
	"return_date" timestamp with time zone,
	"status" varchar(32) DEFAULT 'ยืมอยู่' NOT NULL,
	"condition_on_return" text DEFAULT '' NOT NULL,
	"handled_by" varchar(16),
	"handled_by_name" varchar(128) DEFAULT '' NOT NULL,
	"received_by" varchar(16),
	"received_by_name" varchar(128) DEFAULT '' NOT NULL,
	"source" varchar(16) DEFAULT 'direct' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "requests" (
	"request_id" varchar(16) PRIMARY KEY DEFAULT 'Q' || lpad(nextval('request_seq')::text, 4, '0') NOT NULL,
	"borrower_id" varchar(16) NOT NULL,
	"equipment_id" varchar(16) NOT NULL,
	"requested_at" timestamp with time zone DEFAULT now() NOT NULL,
	"status" varchar(32) DEFAULT 'รอดำเนินการ' NOT NULL,
	"approved_by" varchar(16),
	"record_id" varchar(16),
	"note" text DEFAULT '' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stock_adjustments" (
	"adjustment_id" varchar(16) PRIMARY KEY DEFAULT 'S' || lpad(nextval('adjustment_seq')::text, 4, '0') NOT NULL,
	"equipment_id" varchar(16) NOT NULL,
	"reason" varchar(32) NOT NULL,
	"qty" integer NOT NULL,
	"note" text DEFAULT '' NOT NULL,
	"adjusted_by" varchar(16) NOT NULL,
	"adjusted_by_name" varchar(128) NOT NULL,
	"at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"user_id" varchar(16) PRIMARY KEY DEFAULT 'U' || lpad(nextval('user_seq')::text, 4, '0') NOT NULL,
	"username" varchar(64) NOT NULL,
	"password_hash" text NOT NULL,
	"role" varchar(16) NOT NULL,
	"name" varchar(128) NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_username_unique" UNIQUE("username")
);
--> statement-breakpoint
ALTER TABLE "records" ADD CONSTRAINT "records_borrower_id_borrowers_borrower_id_fk" FOREIGN KEY ("borrower_id") REFERENCES "public"."borrowers"("borrower_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "records" ADD CONSTRAINT "records_equipment_id_equipment_equipment_id_fk" FOREIGN KEY ("equipment_id") REFERENCES "public"."equipment"("equipment_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "requests" ADD CONSTRAINT "requests_borrower_id_borrowers_borrower_id_fk" FOREIGN KEY ("borrower_id") REFERENCES "public"."borrowers"("borrower_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "requests" ADD CONSTRAINT "requests_equipment_id_equipment_equipment_id_fk" FOREIGN KEY ("equipment_id") REFERENCES "public"."equipment"("equipment_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_adjustments" ADD CONSTRAINT "stock_adjustments_equipment_id_equipment_equipment_id_fk" FOREIGN KEY ("equipment_id") REFERENCES "public"."equipment"("equipment_id") ON DELETE no action ON UPDATE no action;