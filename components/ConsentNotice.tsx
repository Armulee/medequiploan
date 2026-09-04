'use client';

import { useState } from 'react';
import Icon from '@/components/Icon';
import { CONSENT_NOTICE } from '@/lib/consent';

/**
 * The PDPA notice and its consent checkbox.
 *
 * The notice is collapsed by default but the checkbox label always states what
 * is being agreed to, so nobody ticks a box whose meaning is hidden. The full
 * text is one tap away rather than behind a link that loses the half-filled
 * form.
 */
export default function ConsentNotice({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label?: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="consent-box">
      <button type="button" className="consent-toggle" onClick={() => setOpen((v) => !v)}>
        <span className="consent-title">
          <Icon name="shield" size={18} stroke="var(--orange-dark)" />
          {CONSENT_NOTICE.title}
        </span>
        <span className="consent-caret" data-open={open}>
          <Icon name="chevron-left" size={18} strokeWidth={2.5} />
        </span>
      </button>

      <p className="consent-intro">{CONSENT_NOTICE.intro}</p>

      {open && (
        <div className="consent-body">
          {CONSENT_NOTICE.sections.map((s) => (
            <div key={s.heading} className="consent-section">
              <h4>{s.heading}</h4>
              <p>{s.body}</p>
            </div>
          ))}
        </div>
      )}

      {!open && (
        <button type="button" className="consent-more" onClick={() => setOpen(true)}>
          อ่านรายละเอียดทั้งหมด
        </button>
      )}

      <label className="consent-check">
        {/* Deliberately not `required`: the browser's own validation blocks
            submission with a small native tooltip that is easy to miss. The
            form checks this itself and shows the reason in the alert box,
            in Thai, where every other error already appears. */}
        <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
        <span>{label ?? CONSENT_NOTICE.checkboxLabel} *</span>
      </label>
    </div>
  );
}
