import UserDetailPage from '@/components/staff/UserDetailPage';

export const metadata = { title: 'รายละเอียดบัญชีเจ้าหน้าที่' };

export default async function StaffUserDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <UserDetailPage userId={id} />;
}
