'use client';

import { useSession } from '@/app/staff/SessionContext';
import AdminOnly from './AdminOnly';
import UsersTab from './UsersTab';

export default function UsersPage() {
  const { user } = useSession();
  if (!user) return null;
  // The nav hides this tab for staff, but the URL is still typeable — and
  // /api/users refuses them either way.
  if (user.role !== 'admin') return <AdminOnly />;
  return <UsersTab currentUser={user} />;
}
