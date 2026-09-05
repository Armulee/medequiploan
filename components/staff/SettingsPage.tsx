'use client';

import { useSession } from '@/app/staff/SessionContext';
import SettingsTab from './SettingsTab';

export default function SettingsPage() {
  const { user } = useSession();
  if (!user) return null;
  return <SettingsTab user={user} />;
}
