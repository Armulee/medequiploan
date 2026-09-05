import AuditDetailPage from '@/components/staff/AuditDetailPage';

export const metadata = { title: 'รายละเอียด Audit Log' };

export default async function StaffAuditDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <AuditDetailPage logId={id} />;
}
