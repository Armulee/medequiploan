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

export function statusBadgeClass(status: string): string {
  if (status === 'คืนแล้ว' || status === 'อนุมัติ') return 'badge badge-green';
  if (status === 'เกินกำหนด' || status === 'ปฏิเสธ') return 'badge badge-red';
  if (status === 'รอดำเนินการ') return 'badge badge-yellow';
  return 'badge badge-orange';
}

export function isValidThaiNationalId(id: string): boolean {
  if (!/^\d{13}$/.test(id)) return false;
  let sum = 0;
  for (let i = 0; i < 12; i++) sum += parseInt(id[i], 10) * (13 - i);
  return (11 - (sum % 11)) % 10 === parseInt(id[12], 10);
}
