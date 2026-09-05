'use client';

import {
  ArrowRightLeft,
  FileCheck,
  History,
  LayoutDashboard,
  LogOut,
  Menu,
  Settings,
  SlidersHorizontal,
  UserPlus,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { useState } from 'react';
import Logo from '@/components/Logo';
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { useSession } from '@/app/staff/SessionContext';
import type { SessionUser } from '@/app/lib/types';

export type TabId =
  | 'dashboard'
  | 'register'
  | 'borrow'
  | 'requests'
  | 'stock'
  | 'history'
  | 'users'
  | 'settings';

// adminOnly tabs are filtered out for staff rather than shown and refused —
// the API enforces the same restriction regardless of what is rendered.
export const TABS: Array<{ id: TabId; label: string; Icon: LucideIcon; adminOnly?: boolean }> = [
  { id: 'dashboard', label: 'ภาพรวม', Icon: LayoutDashboard },
  { id: 'register', label: 'ลงทะเบียน', Icon: UserPlus },
  { id: 'borrow', label: 'ยืม-คืน', Icon: ArrowRightLeft },
  { id: 'requests', label: 'คำขอ', Icon: FileCheck },
  { id: 'stock', label: 'สต็อก', Icon: SlidersHorizontal },
  { id: 'history', label: 'ประวัติ', Icon: History },
  { id: 'users', label: 'เจ้าหน้าที่', Icon: Users, adminOnly: true },
];

export function tabsFor(role: string) {
  return TABS.filter((t) => !t.adminOnly || role === 'admin');
}

const roleLabel = (role: string) => (role === 'admin' ? 'แอดมิน' : 'เจ้าหน้าที่');

export default function AppShell({
  user,
  tab,
  onTabChange,
  children,
}: {
  user: SessionUser;
  tab: TabId;
  onTabChange: (t: TabId) => void;
  children: React.ReactNode;
}) {
  const { logout } = useSession();
  const [menuOpen, setMenuOpen] = useState(false);
  const tabs = tabsFor(user.role);

  const go = (t: TabId) => {
    onTabChange(t);
    setMenuOpen(false);
  };

  return (
    <>
      <header className="app-header">
        <div className="brand">
          <span className="dot" />
          ยืม-คืนกายอุปกรณ์
        </div>

        <nav className="app-nav-desktop">
          {tabs.map((t) => (
            <button key={t.id} className={t.id === tab ? 'active' : ''} onClick={() => go(t.id)}>
              <t.Icon size={18} />
              <span>{t.label}</span>
            </button>
          ))}
        </nav>

        {/* Name, settings and sign-out live here on a desktop. On a phone they
            move into the sheet, so the bar has room for the brand alone. */}
        <div className="userbox max-sm:hidden">
          <span>
            {user.name} ({roleLabel(user.role)})
          </span>
          <button
            className="ghost"
            onClick={() => go('settings')}
            aria-label="ตั้งค่าบัญชี"
            title="ตั้งค่าบัญชี"
          >
            <Settings size={16} />
          </button>
          <button className="ghost" onClick={logout}>
            ออกจากระบบ
          </button>
        </div>

        {/* Seven tabs across the bottom of a phone were 55px wide and unreadable.
            One button opening a sheet gives every destination a full row. */}
        <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
          <SheetTrigger
            className="grid size-11 shrink-0 place-items-center rounded-full border border-white/45 bg-white/15 p-0 text-white shadow-none sm:hidden"
            aria-label="เปิดเมนู"
          >
            <Menu size={22} />
          </SheetTrigger>

          <SheetContent side="bottom" className="max-h-[88dvh] overflow-y-auto pb-[env(safe-area-inset-bottom)]">
            <SheetHeader>
              <SheetTitle className="flex items-center gap-2">
                <span className="grid size-8 place-items-center rounded-[10px] bg-[linear-gradient(135deg,var(--orange)_0%,var(--orange-dark)_100%)] text-white">
                  <Logo size={17} />
                </span>
                {user.name}
              </SheetTitle>
              <SheetDescription>{roleLabel(user.role)} · {user.username}</SheetDescription>
            </SheetHeader>

            <nav className="flex flex-col p-2">
              {tabs.map((t) => (
                <button
                  key={t.id}
                  onClick={() => go(t.id)}
                  className={[
                    'flex items-center gap-3 rounded-[12px] border-none px-3 py-3.5 text-left text-[1.02rem] font-semibold shadow-none',
                    t.id === tab
                      ? 'bg-[var(--orange-light)] text-[var(--orange-deep)]'
                      : 'bg-transparent text-[var(--text)]',
                  ].join(' ')}
                >
                  <t.Icon size={22} />
                  {t.label}
                </button>
              ))}
            </nav>

            <div className="flex flex-col gap-1 border-t border-[var(--border)] p-2">
              <button
                onClick={() => go('settings')}
                className={[
                  'flex items-center gap-3 rounded-[12px] border-none px-3 py-3.5 text-left text-[1.02rem] font-semibold shadow-none',
                  tab === 'settings'
                    ? 'bg-[var(--orange-light)] text-[var(--orange-deep)]'
                    : 'bg-transparent text-[var(--text)]',
                ].join(' ')}
              >
                <Settings size={22} />
                ตั้งค่าบัญชี
              </button>
              <SheetClose asChild>
                <button
                  onClick={logout}
                  className="flex items-center gap-3 rounded-[12px] border-none bg-transparent px-3 py-3.5 text-left text-[1.02rem] font-semibold text-[var(--red)] shadow-none"
                >
                  <LogOut size={22} />
                  ออกจากระบบ
                </button>
              </SheetClose>
            </div>
          </SheetContent>
        </Sheet>
      </header>

      <div className="container">{children}</div>
    </>
  );
}
