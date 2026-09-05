import RequestDetail from '@/components/staff/RequestDetail';

export const metadata = { title: 'รายละเอียดคำขอ' };

export default async function StaffRequestDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <RequestDetail requestId={id} />;
}
