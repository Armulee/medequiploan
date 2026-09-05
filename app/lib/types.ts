export type SessionUser = {
  user_id: string;
  username: string;
  role: 'admin' | 'staff';
  name: string;
};

/** A staff account as /api/users returns it — never a password hash. */
export type StaffUser = {
  user_id: string;
  username: string;
  role: 'admin' | 'staff';
  name: string;
  active: boolean;
  created_at: string;
};

export type Equipment = {
  equipment_id: string;
  name: string;
  category: string;
  total_qty: number;
  available_qty: number;
  low_stock_threshold: number;
  borrowed_qty: number;
  repair_qty: number;
  low_stock: boolean;
  /** Public URL of the catalogue photo, or '' when none was uploaded. */
  image: string;
};

export type BorrowerListItem = {
  borrower_id: string;
  first_name: string;
  last_name: string;
  national_id_masked: string;
  address: string;
  phone: string;
  line_id: string;
  email: string;
  registered_at: string;
  verified: boolean;
  self_registered: boolean;
};

export type BorrowerFull = BorrowerListItem & {
  national_id: string;
  illness_photo_url: string;
  illness_description: string;
  id_card_photo_url: string;
  consent_accepted_at: string | null;
  consent_version: string | null;
};

/** Counted in SQL over every closed loan, not over the page on screen. */
export type OnTimeRate = { judged: number; on_time: number };

export type LoanRecord = {
  record_id: string;
  borrower_id: string;
  equipment_id: string;
  borrow_date: string;
  due_date: string | null;
  return_date: string | null;
  status: string;
  condition_on_return: string;
  handled_by_name: string;
  received_by_name: string;
  source: string;
  borrower_name: string;
  equipment_name: string;
};

export type BorrowRequest = {
  request_id: string;
  borrower_id: string;
  equipment_id: string;
  requested_at: string;
  status: string;
  approved_by: string | null;
  record_id: string | null;
  note: string;
  borrower_name: string;
  borrower_phone?: string;
  borrower_line_id?: string;
  equipment_name: string;
};

export type AuditEntry = {
  log_id: string;
  actor_user_id: string;
  actor_name: string;
  action: string;
  target_type: string;
  target_id: string;
  details: string;
  at: string;
};
