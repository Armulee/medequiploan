import { decrypt, mask } from './crypto';
import type { Borrower, BorrowRequest, Equipment, LoanRecord } from './db/schema';

// Photo ids are turned into /api/files/... URLs so the client never sees a
// storage location it could fetch without a session.
const fileUrl = (id: string | null) => (id ? `/api/files/${id}` : '');

export function borrowerListView(b: Borrower) {
  return {
    borrower_id: b.borrowerId,
    first_name: b.firstName,
    last_name: b.lastName,
    national_id_masked: mask(decrypt(b.nationalIdEnc)),
    address: b.address,
    phone: b.phone,
    line_id: b.lineId,
    email: b.email,
    registered_at: b.registeredAt,
    verified: b.verified,
    self_registered: b.selfRegistered,
  };
}

export function borrowerFullView(b: Borrower) {
  return {
    ...borrowerListView(b),
    national_id: decrypt(b.nationalIdEnc),
    illness_photo_url: fileUrl(b.illnessPhotoId),
    illness_description: b.illnessDescription,
    id_card_photo_url: fileUrl(b.idCardPhotoId),
    consent_accepted_at: b.consentAcceptedAt,
    consent_version: b.consentVersion,
  };
}

/**
 * `onLoan` is the number of units actually out with a borrower, counted from
 * open loan records. Deriving "borrowed" as total - available conflates real
 * loans with units pulled off the shelf for repair, so sending two wheelchairs
 * to the workshop made the stock page claim two more people had borrowed one.
 * Whatever is missing beyond the open loans is out for repair.
 */
export function equipmentView(e: Equipment, onLoan?: number) {
  const missing = e.totalQty - e.availableQty;
  const borrowed = onLoan ?? missing;
  return {
    equipment_id: e.equipmentId,
    name: e.name,
    category: e.category,
    total_qty: e.totalQty,
    available_qty: e.availableQty,
    low_stock_threshold: e.lowStockThreshold,
    borrowed_qty: borrowed,
    repair_qty: Math.max(0, missing - borrowed),
    low_stock: e.availableQty <= e.lowStockThreshold,
  };
}

export function recordView(
  r: LoanRecord,
  status: string,
  borrowerName: string | null,
  equipmentName: string | null
) {
  return {
    record_id: r.recordId,
    borrower_id: r.borrowerId,
    equipment_id: r.equipmentId,
    borrow_date: r.borrowDate,
    due_date: r.dueDate,
    return_date: r.returnDate,
    status,
    condition_on_return: r.conditionOnReturn,
    handled_by: r.handledBy,
    handled_by_name: r.handledByName,
    received_by: r.receivedBy,
    received_by_name: r.receivedByName,
    source: r.source,
    borrower_name: borrowerName ?? r.borrowerId,
    equipment_name: equipmentName ?? r.equipmentId,
  };
}

export function requestView(
  r: BorrowRequest,
  borrowerName?: string | null,
  equipmentName?: string | null
) {
  return {
    request_id: r.requestId,
    borrower_id: r.borrowerId,
    equipment_id: r.equipmentId,
    requested_at: r.requestedAt,
    status: r.status,
    approved_by: r.approvedBy,
    record_id: r.recordId,
    note: r.note,
    borrower_name: borrowerName ?? r.borrowerId,
    equipment_name: equipmentName ?? r.equipmentId,
  };
}
