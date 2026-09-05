'use client';

import { useSession } from '@/app/staff/SessionContext';
import AdminOnly from './AdminOnly';
import UserDetail from './UserDetail';

export default function UserDetailPage({ userId }: { userId: string }) {
  const { user } = useSession();
  if (!user) return null;
  if (user.role !== 'admin') return <AdminOnly />;
  return <UserDetail userId={userId} currentUser={user} />;
}
