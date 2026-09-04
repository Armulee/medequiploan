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
