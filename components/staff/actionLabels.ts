/** Audit actions are stored as codes; the list and the detail must agree. */
export const ACTION_LABELS: Record<string, string> = {
  login: 'เข้าสู่ระบบ',
  logout: 'ออกจากระบบ',
  borrow: 'ยืมอุปกรณ์',
  return: 'รับคืนอุปกรณ์',
  register_borrower: 'ลงทะเบียนผู้ยืม',
  self_register_borrower: 'ผู้ใช้ลงทะเบียนเอง',
  submit_request: 'ส่งคำขอยืม',
  approve_request: 'อนุมัติคำขอ',
  reject_request: 'ปฏิเสธคำขอ',
  create_equipment: 'เพิ่มอุปกรณ์',
  update_equipment: 'แก้ไขอุปกรณ์',
  adjust_stock: 'ตัดสต็อก',
  add_stock: 'เพิ่มสต็อก',
  accept_consent: 'ให้ความยินยอม PDPA',
  login_rate_limited: 'ถูกจำกัดการเข้าสู่ระบบ',
  create_user: 'เพิ่มเจ้าหน้าที่',
  update_user: 'แก้ไขบัญชีเจ้าหน้าที่',
  deactivate_user: 'ปิดใช้งานบัญชี',
  update_own_account: 'แก้ไขบัญชีตัวเอง',
};

export const actionLabel = (action: string) => ACTION_LABELS[action] ?? action;
