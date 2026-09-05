'use client';

import { useEffect, useId, useRef, useState } from 'react';

/**
 * The Turnstile widget, or nothing at all.
 *
 * Renders only when a site key is configured, so the public forms work
 * unchanged in development and for a deployment that has not signed up for
 * Cloudflare. `onToken` is called with the solved token, and with '' whenever
 * the token expires or the challenge fails — the form disables its submit
 * button on the empty string rather than letting someone press send with a
 * token the server is about to reject.
 */
declare global {
  interface Window {
    turnstile?: {
      render: (el: HTMLElement, options: Record<string, unknown>) => string;
      reset: (id: string) => void;
      remove: (id: string) => void;
    };
    onloadTurnstileCallback?: () => void;
  }
}

const SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? '';
const SCRIPT_SRC =
  'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit&onload=onloadTurnstileCallback';

export const turnstileOn = Boolean(SITE_KEY);

export default function Turnstile({
  onToken,
  resetSignal = 0,
}: {
  onToken: (token: string) => void;
  /**
   * Bump this after every submit attempt.
   *
   * A token is spent the moment the server verifies it — including on an
   * attempt that then fails validation for some unrelated reason. Without a
   * reset, correcting a mistyped phone number and pressing send again would
   * replay a used token and be told the challenge expired, which is both
   * wrong and impossible to act on.
   */
  resetSignal?: number;
}) {
  const holder = useRef<HTMLDivElement>(null);
  const widgetId = useRef<string | null>(null);
  const [ready, setReady] = useState(false);
  // Two of these can never be on one page today, but the widget id has to be
  // stable across renders either way.
  const domId = useId();

  useEffect(() => {
    if (!SITE_KEY) return;
    if (window.turnstile) {
      setReady(true);
      return;
    }
    // The script is loaded once and shared; a second form on the same page
    // would find it already there.
    if (!document.querySelector(`script[src="${SCRIPT_SRC}"]`)) {
      window.onloadTurnstileCallback = () => setReady(true);
      const script = document.createElement('script');
      script.src = SCRIPT_SRC;
      script.async = true;
      script.defer = true;
      document.head.appendChild(script);
    } else {
      const prev = window.onloadTurnstileCallback;
      window.onloadTurnstileCallback = () => {
        prev?.();
        setReady(true);
      };
    }
  }, []);

  useEffect(() => {
    if (!ready || !holder.current || !window.turnstile) return;
    const id = window.turnstile.render(holder.current, {
      sitekey: SITE_KEY,
      language: 'th',
      callback: (token: string) => onToken(token),
      // Any of these means the token on hand is worthless, so say so rather
      // than leaving a stale one in the form's state.
      'expired-callback': () => onToken(''),
      'timeout-callback': () => onToken(''),
      'error-callback': () => onToken(''),
    });
    widgetId.current = id;
    return () => {
      widgetId.current = null;
      window.turnstile?.remove(id);
    };
    // onToken is a fresh closure each render; re-rendering the widget on every
    // keystroke would reset the challenge, so it is deliberately not a dep.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  useEffect(() => {
    if (!resetSignal || !widgetId.current) return;
    window.turnstile?.reset(widgetId.current);
    onToken('');
    // Same reasoning as above: only the signal should drive this.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetSignal]);

  if (!SITE_KEY) return null;
  return <div className="turnstile-holder" id={domId} ref={holder} />;
}
