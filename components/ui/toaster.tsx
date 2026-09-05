'use client';

// sonner, themed with the app's variables. Mounted once in the staff layout;
// call toast.success / toast.error from anywhere below it.
import { Toaster as Sonner } from 'sonner';

export function Toaster() {
  return (
    <Sonner
      position="top-center"
      richColors={false}
      closeButton
      // Above the bottom bar on a phone, and clear of the sticky header.
      offset={16}
      toastOptions={{
        style: {
          background: '#FFFFFF',
          border: '1.5px solid var(--border)',
          borderRadius: 'var(--radius-sm)',
          boxShadow: 'var(--shadow-md)',
          color: 'var(--text)',
          fontFamily: "'Noto Sans Thai', 'Segoe UI', system-ui, sans-serif",
          fontSize: '0.95rem',
        },
        classNames: {
          success: '[&_[data-icon]]:text-[var(--green)]',
          error: '[&_[data-icon]]:text-[var(--red)]',
        },
      }}
    />
  );
}
