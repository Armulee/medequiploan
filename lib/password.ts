/**
 * The password rules, in one place.
 *
 * Eight characters was the old floor and is no longer defensible for an
 * account that can open photographs of other people's ID cards. Twelve, with
 * the obvious junk refused: length is what actually costs an attacker, and a
 * length rule alone still lets through "111111111111" and the username typed
 * twice.
 *
 * Deliberately not a character-class rule (upper + digit + symbol). Those push
 * people towards Password1! and towards writing it on the monitor, which for
 * staff sharing a counter is exactly the failure we are trying to avoid.
 */
export const MIN_PASSWORD = 12;

/** Passwords that turn up first in every list an attacker owns. */
const OBVIOUS = [
  'password', 'passw0rd', '123456', '12345678', '123456789', '1234567890',
  'qwerty', 'qwertyuiop', 'abc123', 'iloveyou', 'admin', 'administrator',
  'welcome', 'letmein', 'monkey', 'dragon', 'sunshine', 'princess',
  'medequip', 'wheelchair', 'hospital', 'thailand',
];

/**
 * Returns a Thai message when the password should be refused, or null when it
 * is acceptable. `context` is anything it must not simply repeat — the
 * username and the person's name.
 */
export function passwordProblem(password: string, context: string[] = []): string | null {
  if (password.length < MIN_PASSWORD) {
    return `รหัสผ่านต้องยาวอย่างน้อย ${MIN_PASSWORD} ตัวอักษร`;
  }
  const lower = password.toLowerCase();

  if (OBVIOUS.some((bad) => lower === bad || lower.startsWith(bad) || lower.endsWith(bad))) {
    return 'รหัสผ่านนี้เดาง่ายเกินไป กรุณาใช้รหัสผ่านอื่น';
  }
  // One repeated character, or a straight run like 1234567890 / abcdefghij.
  if (/^(.)\1+$/.test(password)) {
    return 'รหัสผ่านต้องไม่ใช่ตัวอักษรเดิมซ้ำทั้งหมด';
  }
  if (isSequential(lower)) {
    return 'รหัสผ่านต้องไม่ใช่ตัวอักษรหรือตัวเลขเรียงติดกันทั้งหมด';
  }
  for (const item of context) {
    const trimmed = item.trim().toLowerCase();
    if (trimmed.length >= 3 && lower.includes(trimmed)) {
      return 'รหัสผ่านต้องไม่มีชื่อผู้ใช้หรือชื่อของท่านอยู่ในนั้น';
    }
  }
  return null;
}

function isSequential(value: string): boolean {
  if (value.length < 4) return false;
  let up = true;
  let down = true;
  for (let i = 1; i < value.length; i++) {
    const step = value.charCodeAt(i) - value.charCodeAt(i - 1);
    if (step !== 1) up = false;
    if (step !== -1) down = false;
  }
  return up || down;
}
