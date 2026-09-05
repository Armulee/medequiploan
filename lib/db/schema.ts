import { sql } from 'drizzle-orm';
import {
  boolean,
  integer,
  pgTable,
  text,
  timestamp,
  varchar,
} from 'drizzle-orm/pg-core';

// Human-readable IDs (B0001, E0001, ...) are kept from the JSON-file version so
// existing printed forms and staff habits still line up. They are backed by
// Postgres sequences rather than "max + 1" scanning, so two concurrent inserts
// can never be handed the same ID the way they could before.
const seqId = (columnName: string, prefix: string, seqName: string) =>
  varchar(columnName, { length: 16 })
    .primaryKey()
    .default(sql.raw(`'${prefix}' || lpad(nextval('${seqName}')::text, 4, '0')`));

export const users = pgTable('users', {
  userId: seqId('user_id', 'U', 'user_seq'),
  username: varchar('username', { length: 64 }).notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  role: varchar('role', { length: 16 }).notNull(), // 'admin' | 'staff'
  name: varchar('name', { length: 128 }).notNull(),
  active: boolean('active').notNull().default(true),
  /**
   * Bumped to invalidate every cookie already issued for this account —
   * closing it, changing the password, or resetting the passkeys. Every
   * authenticated request compares the cookie's copy against this.
   */
  sessionVersion: integer('session_version').notNull().default(1),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const borrowers = pgTable('borrowers', {
  borrowerId: seqId('borrower_id', 'B', 'borrower_seq'),
  firstName: varchar('first_name', { length: 128 }).notNull(),
  lastName: varchar('last_name', { length: 128 }).notNull(),
  // AES-256-GCM ciphertext — never store the national ID in plain text.
  nationalIdEnc: text('national_id_enc').notNull(),
  // SHA-256 of the national ID, so "does this person already exist?" is an
  // indexed lookup instead of decrypting every row (what the old code did).
  nationalIdHash: varchar('national_id_hash', { length: 64 }).notNull().unique(),
  address: text('address').notNull(),
  // Staff have to be able to ring people back — the form promises a callback,
  // so a contact number is required. Not encrypted: staff read and dial it
  // constantly, and it is far less sensitive than a national ID.
  phone: varchar('phone', { length: 20 }).notNull().default(''),
  lineId: varchar('line_id', { length: 64 }).notNull().default(''),
  email: varchar('email', { length: 254 }).notNull().default(''),
  // Consent is recorded with its timestamp and the version of the notice that
  // was shown. A bare boolean proves nothing later: PDPA asks what someone
  // agreed to and when, and the wording of the notice will change over time.
  consentAcceptedAt: timestamp('consent_accepted_at', { withTimezone: true }),
  consentVersion: varchar('consent_version', { length: 16 }),
  illnessPhotoId: varchar('illness_photo_id', { length: 64 }),
  illnessDescription: text('illness_description').notNull().default(''),
  idCardPhotoId: varchar('id_card_photo_id', { length: 64 }),
  registeredAt: timestamp('registered_at', { withTimezone: true }).notNull().defaultNow(),
  verified: boolean('verified').notNull().default(false),
  selfRegistered: boolean('self_registered').notNull().default(false),
  registeredBy: varchar('registered_by', { length: 16 }),
});

export const equipment = pgTable('equipment', {
  equipmentId: seqId('equipment_id', 'E', 'equipment_seq'),
  name: varchar('name', { length: 256 }).notNull(),
  category: varchar('category', { length: 128 }).notNull().default(''),
  totalQty: integer('total_qty').notNull(),
  availableQty: integer('available_qty').notNull(),
  lowStockThreshold: integer('low_stock_threshold').notNull().default(2),
  /** Storage id of the catalogue photo, e.g. equipment/1699…_ab12.webp. */
  imageId: varchar('image_id', { length: 256 }).notNull().default(''),
});

export const records = pgTable('records', {
  recordId: seqId('record_id', 'R', 'record_seq'),
  borrowerId: varchar('borrower_id', { length: 16 })
    .notNull()
    .references(() => borrowers.borrowerId),
  equipmentId: varchar('equipment_id', { length: 16 })
    .notNull()
    .references(() => equipment.equipmentId),
  borrowDate: timestamp('borrow_date', { withTimezone: true }).notNull().defaultNow(),
  dueDate: timestamp('due_date', { withTimezone: true }),
  returnDate: timestamp('return_date', { withTimezone: true }),
  status: varchar('status', { length: 32 }).notNull().default('ยืมอยู่'),
  conditionOnReturn: text('condition_on_return').notNull().default(''),
  handledBy: varchar('handled_by', { length: 16 }),
  handledByName: varchar('handled_by_name', { length: 128 }).notNull().default(''),
  receivedBy: varchar('received_by', { length: 16 }),
  receivedByName: varchar('received_by_name', { length: 128 }).notNull().default(''),
  source: varchar('source', { length: 16 }).notNull().default('direct'), // 'direct' | 'request'
});

export const requests = pgTable('requests', {
  requestId: seqId('request_id', 'Q', 'request_seq'),
  borrowerId: varchar('borrower_id', { length: 16 })
    .notNull()
    .references(() => borrowers.borrowerId),
  equipmentId: varchar('equipment_id', { length: 16 })
    .notNull()
    .references(() => equipment.equipmentId),
  requestedAt: timestamp('requested_at', { withTimezone: true }).notNull().defaultNow(),
  status: varchar('status', { length: 32 }).notNull().default('รอดำเนินการ'),
  approvedBy: varchar('approved_by', { length: 16 }),
  recordId: varchar('record_id', { length: 16 }),
  note: text('note').notNull().default(''),

  /**
   * What this submission actually said, kept on the request rather than
   * written over the borrower.
   *
   * The public form used to update the borrower row whenever the national ID
   * matched an existing one. Anyone who knew a person's ID — and in Thailand
   * that is not a secret — could therefore change that person's phone number,
   * LINE, email and ID photograph on file, in their name, without ever
   * proving they were them. Staff would then ring the attacker back.
   *
   * So a request now carries its own copy. Staff see it beside what is on
   * file, are told when the two differ, and decide whether to adopt it.
   */
  contactName: varchar('contact_name', { length: 256 }).notNull().default(''),
  contactPhone: varchar('contact_phone', { length: 20 }).notNull().default(''),
  contactLineId: varchar('contact_line_id', { length: 64 }).notNull().default(''),
  contactEmail: varchar('contact_email', { length: 254 }).notNull().default(''),
  contactAddress: text('contact_address').notNull().default(''),
  /** The card photographed for THIS request — what staff check before approving. */
  idCardPhotoId: varchar('id_card_photo_id', { length: 64 }),
  illnessPhotoId: varchar('illness_photo_id', { length: 64 }),
  consentAcceptedAt: timestamp('consent_accepted_at', { withTimezone: true }),
  consentVersion: varchar('consent_version', { length: 16 }),
});

export const auditLog = pgTable('audit_log', {
  logId: seqId('log_id', 'L', 'audit_seq'),
  actorUserId: varchar('actor_user_id', { length: 16 }).notNull().default('public'),
  actorName: varchar('actor_name', { length: 128 }).notNull(),
  action: varchar('action', { length: 64 }).notNull(),
  targetType: varchar('target_type', { length: 32 }).notNull(),
  targetId: varchar('target_id', { length: 32 }).notNull().default(''),
  details: text('details').notNull().default(''),
  at: timestamp('at', { withTimezone: true }).notNull().defaultNow(),
});

// Stock movements that are not borrow/return: damaged, lost, sent for repair,
// returned from repair. The old system had no way to record these at all, so
// on-hand counts drifted from reality every time a wheelchair broke.
export const stockAdjustments = pgTable('stock_adjustments', {
  adjustmentId: seqId('adjustment_id', 'S', 'adjustment_seq'),
  equipmentId: varchar('equipment_id', { length: 16 })
    .notNull()
    .references(() => equipment.equipmentId),
  reason: varchar('reason', { length: 32 }).notNull(), // ชำรุด | สูญหาย | ส่งซ่อม | รับกลับจากซ่อม
  qty: integer('qty').notNull(),
  note: text('note').notNull().default(''),
  adjustedBy: varchar('adjusted_by', { length: 16 }).notNull(),
  adjustedByName: varchar('adjusted_by_name', { length: 128 }).notNull(),
  at: timestamp('at', { withTimezone: true }).notNull().defaultNow(),
});

/**
 * Fixed-window counters for rate limiting.
 *
 * Kept in Postgres rather than process memory because each serverless
 * invocation may be a different instance with its own heap — an in-process
 * counter would reset constantly and enforce nothing. The key encodes both the
 * bucket and the subject, e.g. "login:user:admin" or "request:ip:1.2.3.4".
 */
export const rateLimits = pgTable('rate_limits', {
  key: varchar('key', { length: 200 }).primaryKey(),
  count: integer('count').notNull().default(0),
  windowStart: timestamp('window_start', { withTimezone: true }).notNull().defaultNow(),
});

export type User = typeof users.$inferSelect;
export type Borrower = typeof borrowers.$inferSelect;
export type Equipment = typeof equipment.$inferSelect;
export type LoanRecord = typeof records.$inferSelect;
export type BorrowRequest = typeof requests.$inferSelect;
export type AuditEntry = typeof auditLog.$inferSelect;
export type StockAdjustment = typeof stockAdjustments.$inferSelect;
export type RateLimit = typeof rateLimits.$inferSelect;
