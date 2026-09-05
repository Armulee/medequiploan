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
import Link from 'next/link';
import { usePathname } from 'next/navigation';
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

type Tab = {
  href: string;
  label: string;
  Icon: LucideIcon;
  adminOnly?: boolean;
  /** Detail routes that belong to this tab, so the nav stays lit inside them. */
  also?: string[];
};

// adminOnly tabs are filtered out for staff rather than shown and refused —
// the API enforces the same restriction regardless of what is rendered.
const TABS: Tab[] = [
  { href: '/staff', label: 'ภาพรวม', Icon: LayoutDashboard },
  { href: '/staff/register', label: 'ลงทะเบียน', Icon: UserPlus },
  { href: '/staff/borrow', label: 'ยืม-คืน', Icon: ArrowRightLeft },
  { href: '/staff/requests', label: 'คำขอ', Icon: FileCheck, also: ['/staff/borrowers'] },
  { href: '/staff/stock', label: 'สต็อก', Icon: SlidersHorizontal },
  {
    href: '/staff/history',
    label: 'ประวัติ',
    Icon: History,
    also: ['/staff/records', '/staff/audit'],
  },
  { href: '/staff/users', label: 'เจ้าหน้าที่', Icon: Users, adminOnly: true },
];

function tabsFor(role: string) {
  return TABS.filter((t) => !t.adminOnly || role === 'admin');
}

/** The dashboard is the index of /staff, so only it matches exactly. */
function isActive(tab: Tab, pathname: string) {
  const hit = (base: string) => pathname === base || pathname.startsWith(`${base}/`);
  if (tab.href === '/staff') return pathname === '/staff';
  return hit(tab.href) || (tab.also ?? []).some(hit);
}

const roleLabel = (role: string) => (role === 'admin' ? 'แอดมิน' : 'เจ้าหน้าที่');

export default function AppShell({
  user,
  children,
}: {
  user: SessionUser;
  children: React.ReactNode;
}) {
  const { logout } = useSession();
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const tabs = tabsFor(user.role);
  const settingsActive = pathname.startsWith('/staff/settings');

  const close = () => setMenuOpen(false);

  return (
    <>
      <header className="app-header">
        <div className="brand">
          <span className="dot" />
          ยืม-คืนกายอุปกรณ์
        </div>

        <nav className="app-nav-desktop">
          {tabs.map((t) => (
            <Link key={t.href} href={t.href} className={isActive(t, pathname) ? 'active' : ''}>
              <t.Icon size={18} />
              <span>{t.label}</span>
            </Link>
          ))}
        </nav>

        {/* Name, settings and sign-out live here on a desktop. On a phone they
            move into the sheet, so the bar has room for the brand alone. */}
        <div className="userbox max-sm:hidden">
          <span>
            {user.name} ({roleLabel(user.role)})
          </span>
          <Link
            className="ghost"
            href="/staff/settings"
            aria-label="ตั้งค่าบัญชี"
            title="ตั้งค่าบัญชี"
          >
            <Settings size={16} />
          </Link>
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
                <Link
                  key={t.href}
                  href={t.href}
                  onClick={close}
                  className={[
                    'flex items-center gap-3 rounded-[12px] px-3 py-3.5 text-left text-[1.02rem] font-semibold no-underline',
                    isActive(t, pathname)
                      ? 'bg-[var(--orange-light)] text-[var(--orange-deep)]'
                      : 'bg-transparent text-[var(--text)]',
                  ].join(' ')}
                >
                  <t.Icon size={22} />
                  {t.label}
                </Link>
              ))}
            </nav>

            <div className="flex flex-col gap-1 border-t border-[var(--border)] p-2">
              <Link
                href="/staff/settings"
                onClick={close}
                className={[
                  'flex items-center gap-3 rounded-[12px] px-3 py-3.5 text-left text-[1.02rem] font-semibold no-underline',
                  settingsActive
                    ? 'bg-[var(--orange-light)] text-[var(--orange-deep)]'
                    : 'bg-transparent text-[var(--text)]',
                ].join(' ')}
              >
                <Settings size={22} />
                ตั้งค่าบัญชี
              </Link>
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
