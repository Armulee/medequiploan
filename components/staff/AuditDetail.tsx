'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { api } from '@/app/lib/api';
import { thDateTime } from '@/app/lib/format';
import { actionLabel } from './actionLabels';
import BackLink from './BackLink';
import type { AuditEntry } from '@/app/lib/types';

const BACK = '/staff/history?tab=audit';

/** One audit line in full: the list has to stay scannable, this does not. */
export default function AuditDetail({ logId }: { logId: string }) {
  const [entry, setEntry] = useState<AuditEntry | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    api<{ entry: AuditEntry }>(`/api/audit-log/${logId}`)
      .then((d) => setEntry(d.entry))
      .catch((e) => {
        setFailed(true);
        toast.error(e instanceof Error ? e.message : 'โหลดรายการไม่สำเร็จ');
      });
  }, [logId]);

  if (failed || !entry) {
    return (
      <>
        <BackLink href={BACK} />
        <div className="card">
          <div className="empty-state">{failed ? 'ไม่พบรายการนี้' : 'กำลังโหลด...'}</div>
        </div>
      </>
    );
  }

  return (
    <>
      <BackLink href={BACK} />

      <div className="card">
        <div className="card-head">
          <h1>{actionLabel(entry.action)}</h1>
          <span className="badge badge-active">{entry.log_id}</span>
        </div>

        <dl className="detail-grid">
          <div>
            <dt>เวลา</dt>
            <dd>{thDateTime(entry.at)}</dd>
          </div>
          <div>
            <dt>ผู้ทำรายการ</dt>
            <dd>{entry.actor_name}</dd>
          </div>
          <div>
            <dt>รหัสผู้ทำรายการ</dt>
            <dd>{entry.actor_user_id || '-'}</dd>
          </div>
          <div>
            <dt>ชนิดข้อมูลที่ถูกกระทำ</dt>
            <dd>{entry.target_type || '-'}</dd>
          </div>
          <div>
            <dt>รหัสข้อมูลที่ถูกกระทำ</dt>
            <dd>{entry.target_id || '-'}</dd>
          </div>
          <div>
            {/* The raw code as well as the Thai label: a line written by a
                version that knew an action this one does not would otherwise
                show only its own key. */}
            <dt>รหัสการกระทำ</dt>
            <dd>{entry.action}</dd>
          </div>
          <div className="detail-wide">
            <dt>รายละเอียด</dt>
            <dd style={{ whiteSpace: 'pre-wrap' }}>{entry.details || '-'}</dd>
          </div>
        </dl>
      </div>
    </>
  );
}
