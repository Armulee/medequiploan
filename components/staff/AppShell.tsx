'use client';

import Icon from '@/components/Icon';
import { useSession } from '@/app/staff/SessionContext';
import type { SessionUser } from '@/app/lib/types';

export type TabId = 'dashboard' | 'register' | 'borrow' | 'requests' | 'stock' | 'history' | 'users';

// adminOnly tabs are filtered out for staff rather than shown and refused —
// the API enforces the same restriction regardless of what is rendered.
export const TABS: Array<{ id: TabId; label: string; icon: string; adminOnly?: boolean }> = [
  { id: 'dashboard', label: 'ภาพรวม', icon: 'dashboard' },
  { id: 'register', label: 'ลงทะเบียน', icon: 'register' },
  { id: 'borrow', label: 'ยืม-คืน', icon: 'borrow' },
  { id: 'requests', label: 'คำขอ', icon: 'requests' },
  { id: 'stock', label: 'สต็อก', icon: 'stock' },
  { id: 'history', label: 'ประวัติ', icon: 'history' },
  { id: 'users', label: 'เจ้าหน้าที่', icon: 'users', adminOnly: true },
];

export function tabsFor(role: string) {
  return TABS.filter((t) => !t.adminOnly || role === 'admin');
}

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
  const tabs = tabsFor(user.role);

  return (
    <>
      <header className="app-header">
        <div className="brand">
          <span className="dot" />
          ยืม-คืนกายอุปกรณ์
        </div>
        <nav className="app-nav-desktop">
          {tabs.map((t) => (
            <button
              key={t.id}
              className={t.id === tab ? 'active' : ''}
              onClick={() => onTabChange(t.id)}
            >
              <Icon name={t.icon} size={18} />
              <span>{t.label}</span>
            </button>
          ))}
        </nav>
        <div className="userbox">
          <span>
            {user.name} ({user.role === 'admin' ? 'แอดมิน' : 'เจ้าหน้าที่'})
          </span>
          <button className="ghost" onClick={logout}>
            ออกจากระบบ
          </button>
        </div>
      </header>

      <div className="container">{children}</div>

      <nav className="tabbar">
        {tabs.map((t) => (
          <button
            key={t.id}
            className={t.id === tab ? 'active' : ''}
            onClick={() => onTabChange(t.id)}
          >
            <Icon name={t.icon} size={20} />
            <span>{t.label}</span>
          </button>
        ))}
      </nav>
    </>
  );
}
