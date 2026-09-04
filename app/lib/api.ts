'use client';

// Every request goes through here so a failed call surfaces the server's Thai
// error message instead of a generic "fetch failed".
export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(path, { credentials: 'same-origin', ...options });
  const text = await res.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    // Non-JSON body (a proxy error page, say) — fall through to the status.
  }
  if (!res.ok) {
    const message =
      (data as { error?: string } | null)?.error ?? `เกิดข้อผิดพลาด (${res.status})`;
    throw new Error(message);
  }
  return data as T;
}

export function apiJson<T>(path: string, method: string, body?: unknown): Promise<T> {
  return api<T>(path, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

export function apiForm<T>(path: string, form: FormData): Promise<T> {
  return api<T>(path, { method: 'POST', body: form });
}
