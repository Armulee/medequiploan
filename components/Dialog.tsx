'use client';

import { useEffect } from 'react';

/**
 * Modal shell shared by every confirmation and form dialog, replacing the
 * window.prompt() calls the staff app used for approvals and returns. A native
 * prompt can't be styled, can't be validated before it closes, and gives no
 * way to offer a date picker or a set of choices.
 */
export default function Dialog({
  title,
  subtitle,
  onClose,
  children,
  width = 460,
}: {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: React.ReactNode;
  width?: number;
}) {
  // Escape closes, and the page behind must not scroll while it is open.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previous;
    };
  }, [onClose]);

  return (
    <div className="modal-backdrop" onClick={onClose} role="presentation">
      <div
        className="modal card"
        style={{ maxWidth: width }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <h2 style={{ marginBottom: subtitle ? 2 : 12 }}>{title}</h2>
        {subtitle && (
          <p style={{ color: 'var(--text-muted)', marginTop: 0, marginBottom: 14 }}>{subtitle}</p>
        )}
        {children}
      </div>
    </div>
  );
}

export function DialogActions({
  confirmLabel,
  onCancel,
  busy,
  danger,
}: {
  confirmLabel: string;
  onCancel: () => void;
  busy?: boolean;
  danger?: boolean;
}) {
  return (
    <div className="dialog-actions">
      <button type="submit" className={`btn ${danger ? 'btn-danger' : 'btn-primary'}`} disabled={busy}>
        {busy ? 'กำลังบันทึก...' : confirmLabel}
      </button>
      <button type="button" className="btn btn-outline" onClick={onCancel} disabled={busy}>
        ยกเลิก
      </button>
    </div>
  );
}
