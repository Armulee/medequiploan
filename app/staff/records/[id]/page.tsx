import RecordDetail from '@/components/staff/RecordDetail';

export const metadata = { title: 'รายละเอียดการยืม' };

export default async function StaffRecordDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <RecordDetail recordId={id} />;
}
