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
  adopt_request_contact: 'อัปเดตข้อมูลผู้ยืมจากคำขอ',
  read_personal_data: 'เปิดดูข้อมูลส่วนบุคคล',
  login_passkey: 'เข้าสู่ระบบด้วยพาสคีย์',
  create_passkey: 'สร้างพาสคีย์',
  delete_passkey: 'ลบพาสคีย์',
  reset_passkeys: 'รีเซ็ตพาสคีย์ให้เจ้าหน้าที่',
  // Written when an authenticator replays a counter it should have advanced —
  // the classic sign of a cloned credential. Worth a name that says so.
  passkey_counter_stall: 'พาสคีย์ส่งเลขนับซ้ำ (น่าสงสัย)',
  retention_sweep: 'ลบข้อมูลส่วนบุคคลตามกำหนด (PDPA)',
  retention_preview: 'ตรวจสอบรายชื่อที่ถึงกำหนดลบ',
};

export const actionLabel = (action: string) => ACTION_LABELS[action] ?? action;
