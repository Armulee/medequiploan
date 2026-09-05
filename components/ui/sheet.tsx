'use client';

// shadcn/ui sheet, on Radix Dialog. Used for the staff app's navigation on a
// phone, where seven tabs across the bottom were unreadable.
import * as SheetPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import * as React from 'react';
import { cn } from '@/lib/cn';

const Sheet = SheetPrimitive.Root;
const SheetTrigger = SheetPrimitive.Trigger;
const SheetClose = SheetPrimitive.Close;

const SIDES = {
  top: 'inset-x-0 top-0 border-b data-[state=closed]:slide-out-to-top data-[state=open]:slide-in-from-top',
  bottom:
    'inset-x-0 bottom-0 rounded-t-[20px] border-t data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom',
  left: 'inset-y-0 left-0 h-full w-[19rem] border-r data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left',
  right:
    'inset-y-0 right-0 h-full w-[19rem] border-l data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right',
} as const;

function SheetContent({
  className,
  children,
  side = 'bottom',
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Content> & { side?: keyof typeof SIDES }) {
  return (
    <SheetPrimitive.Portal>
      <SheetPrimitive.Overlay
        className={cn(
          'fixed inset-0 z-50 bg-[rgba(38,32,25,0.45)]',
          'data-[state=open]:animate-in data-[state=closed]:animate-out',
          'data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0'
        )}
      />
      <SheetPrimitive.Content
        data-slot="sheet-content"
        className={cn(
          'fixed z-50 flex flex-col gap-0 border-[var(--border)] bg-white',
          'shadow-[0_16px_44px_rgba(184,66,12,0.16)]',
          'transition ease-in-out data-[state=open]:animate-in data-[state=closed]:animate-out',
          'data-[state=open]:duration-200 data-[state=closed]:duration-150',
          SIDES[side],
          className
        )}
        {...props}
      >
        {children}
        <SheetPrimitive.Close
          className={cn(
            'absolute right-3 top-3 grid size-10 place-items-center rounded-full',
            'border-none bg-transparent p-0 text-[var(--text-muted)] shadow-none',
            'hover:bg-[var(--orange-bg)] hover:text-[var(--orange-dark)]'
          )}
        >
          <X size={22} />
          <span className="sr-only">ปิด</span>
        </SheetPrimitive.Close>
      </SheetPrimitive.Content>
    </SheetPrimitive.Portal>
  );
}

function SheetHeader({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="sheet-header"
      className={cn('border-b border-[var(--border)] px-5 py-4 pr-14', className)}
      {...props}
    />
  );
}

function SheetTitle({ className, ...props }: React.ComponentProps<typeof SheetPrimitive.Title>) {
  return (
    <SheetPrimitive.Title
      data-slot="sheet-title"
      className={cn(
        "m-0 font-['Kanit','Noto_Sans_Thai',sans-serif] text-[1.15rem] font-semibold",
        className
      )}
      {...props}
    />
  );
}

function SheetDescription({
  className,
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Description>) {
  return (
    <SheetPrimitive.Description
      data-slot="sheet-description"
      className={cn('mt-0.5 text-[0.88rem] text-[var(--text-muted)]', className)}
      {...props}
    />
  );
}

export { Sheet, SheetClose, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger };
