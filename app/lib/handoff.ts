'use client';

/**
 * Carries the national ID from the submitted-request screen to the tracking
 * page without it ever appearing in a URL.
 *
 * A query string would put the number in browser history, in the Referer
 * header of anything the next page loads, and in the hosting platform's access
 * logs. sessionStorage stays in the tab, is never sent anywhere, and dies when
 * the tab closes. The value is also removed the moment it is read, so a back
 * button or a later visit starts from an empty field.
 */
const KEY = 'medequip.track.nid';

export function stashNationalId(nationalId: string): void {
  try {
    sessionStorage.setItem(KEY, nationalId);
  } catch {
    // Private browsing or blocked storage — the tracking page just asks for it.
  }
}

export function takeNationalId(): string {
  try {
    const value = sessionStorage.getItem(KEY) ?? '';
    sessionStorage.removeItem(KEY);
    return value;
  } catch {
    return '';
  }
}
