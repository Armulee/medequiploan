// Thai national ID: 13 digits, last one is a mod-11 checksum.
export function isValidThaiNationalId(id: string): boolean {
  if (!/^\d{13}$/.test(id)) return false;
  let sum = 0;
  for (let i = 0; i < 12; i++) sum += parseInt(id[i], 10) * (13 - i);
  return (11 - (sum % 11)) % 10 === parseInt(id[12], 10);
}

/**
 * Thai mobile or landline. Accepts the separators people actually type
 * (spaces, dashes, brackets) and returns the digits, or null when it isn't a
 * usable number.
 */
export function normalisePhone(input: string): string | null {
  const digits = input.replace(/[\s\-().]/g, '');
  // 0812345678 (mobile, 10) or 021234567 (Bangkok landline, 9)
  if (!/^0\d{8,9}$/.test(digits)) return null;
  return digits;
}

/**
 * Optional field, so an empty string is valid. Deliberately permissive — the
 * only way to truly validate an address is to send to it, and rejecting an
 * unusual but real address is worse than accepting a typo in a field nobody
 * is required to fill in.
 */
export function normaliseEmail(input: string): string | null {
  const value = input.trim();
  if (!value) return '';
  if (value.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return null;
  return value.toLowerCase();
}
