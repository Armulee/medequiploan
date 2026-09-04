// Thai Buddhist-era dates, matching what the previous UI displayed.
export function thDate(iso: string | Date | null | undefined): string {
  if (!iso) return '-';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '-';
  return d.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function thDateTime(iso: string | Date | null | undefined): string {
  if (!iso) return '-';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '-';
  return d.toLocaleString('th-TH', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// Names must match the variants defined in globals.css — badge-green and
// friends were invented here and matched nothing, so every status rendered as
// unstyled text with no pill behind it.
const BADGE_VARIANT: Record<string, string> = {
  คืนแล้ว: 'badge-returned',
  อนุมัติ: 'badge-approved',
  เกินกำหนด: 'badge-overdue',
  ปฏิเสธ: 'badge-rejected',
  รอดำเนินการ: 'badge-pending',
  ยืมอยู่: 'badge-active',
};

export function statusBadgeClass(status: string): string {
  return `badge ${BADGE_VARIANT[status] ?? 'badge-active'}`;
}

export function isValidThaiNationalId(id: string): boolean {
  if (!/^\d{13}$/.test(id)) return false;
  let sum = 0;
  for (let i = 0; i < 12; i++) sum += parseInt(id[i], 10) * (13 - i);
  return (11 - (sum % 11)) % 10 === parseInt(id[12], 10);
}
