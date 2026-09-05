'use client';

import {
  Dialog as UIDialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

/**
 * The app's dialog shell, now a thin adapter over the shadcn/Radix dialog in
 * components/ui/dialog.tsx.
 *
 * Kept as an adapter rather than rewritten into every call site because the
 * three tabs that use it pass forms with their own submit handling: swapping
 * the shell underneath gets Radix's focus trap, escape handling, portal and
 * scroll lock without touching that logic. The hand-rolled version had the
 * escape key and the scroll lock but no focus trap — tab would walk straight
 * out of the dialog and into the page behind it.
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
  return (
    <UIDialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent style={{ maxWidth: width }}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {subtitle && <DialogDescription>{subtitle}</DialogDescription>}
        </DialogHeader>
        {children}
      </DialogContent>
    </UIDialog>
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
    <DialogFooter>
      <button type="submit" className={`btn ${danger ? 'btn-danger' : 'btn-primary'}`} disabled={busy}>
        {busy ? 'กำลังบันทึก...' : confirmLabel}
      </button>
      <button type="button" className="btn btn-outline" onClick={onCancel} disabled={busy}>
        ยกเลิก
      </button>
    </DialogFooter>
  );
}
