'use client';

import { ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { api } from '@/app/lib/api';
import { statusBadgeClass, thDate, thDateTime } from '@/app/lib/format';
import { actionLabel } from './actionLabels';
import BorrowerSearch from './BorrowerSearch';
import type { AuditEntry, BorrowerListItem, Equipment, LoanRecord } from '@/app/lib/types';

const SUBS = ['borrower', 'equipment', 'audit'] as const;
type SubTab = (typeof SUBS)[number];

export default function HistoryTab({ isAdmin }: { isAdmin: boolean }) {
  const router = useRouter();
  const params = useSearchParams();
  const asked = params.get('tab') as SubTab | null;
  // Held in the URL, so a back gesture out of a record returns to the sub-tab
  // it was opened from rather than resetting to the first one.
  const sub: SubTab = asked && SUBS.includes(asked) && (asked !== 'audit' || isAdmin)
    ? asked
    : 'borrower';

  const go = (next: SubTab) =>
    router.replace(next === 'borrower' ? '/staff/history' : `/staff/history?tab=${next}`);

  return (
    <div className="card">
      <h1>ประวัติการใช้งาน</h1>
      <div className="filter-row">
        <button
          className={`btn btn-sm ${sub === 'borrower' ? 'btn-primary' : 'btn-outline'}`}
          onClick={() => go('borrower')}
        >
          ประวัติผู้ยืม
        </button>
        <button
          className={`btn btn-sm ${sub === 'equipment' ? 'btn-primary' : 'btn-outline'}`}
          onClick={() => go('equipment')}
        >
          ประวัติอุปกรณ์
        </button>
        {/* Names who did what to whose record — oversight, not everyday use. */}
        {isAdmin && (
          <button
            className={`btn btn-sm ${sub === 'audit' ? 'btn-primary' : 'btn-outline'}`}
            onClick={() => go('audit')}
          >
            Audit Log
          </button>
        )}
      </div>

      {sub === 'borrower' && <BorrowerHistory />}
      {sub === 'equipment' && <EquipmentHistory />}
      {sub === 'audit' && isAdmin && <AuditLog />}
    </div>
  );
}

function RecordList({ records }: { records: LoanRecord[] }) {
  if (records.length === 0) return <div className="empty-state">ยังไม่มีประวัติการยืม</div>;
  return (
    <div className="list">
      {records.map((r) => (
        <Link
          className="list-row clickable"
          key={r.record_id}
          href={`/staff/records/${r.record_id}`}
        >
          <div>
            <div className="title">{r.equipment_name}</div>
            <div className="sub">
              {r.borrower_name} · ยืม {thDate(r.borrow_date)}
              {r.due_date ? ` · ครบกำหนด ${thDate(r.due_date)}` : ''}
              {r.return_date ? ` · คืน ${thDate(r.return_date)}` : ''}
            </div>
          </div>
          <span style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
            <span className={statusBadgeClass(r.status)}>{r.status}</span>
            <ChevronRight size={16} className="stat-arrow" />
          </span>
        </Link>
      ))}
    </div>
  );
}

function BorrowerHistory() {
  const [picked, setPicked] = useState<BorrowerListItem | null>(null);
  const [records, setRecords] = useState<LoanRecord[] | null>(null);

  useEffect(() => {
    if (!picked) return;
    setRecords(null);
    api<{ records: LoanRecord[] }>(`/api/records?borrower_id=${encodeURIComponent(picked.borrower_id)}`)
      .then((d) => setRecords(d.records))
      .catch((e) => {
        setRecords([]);
        toast.error(e instanceof Error ? e.message : 'โหลดประวัติไม่สำเร็จ');
      });
  }, [picked]);

  // Only loans that had a due date can be judged on-time, so the rate is
  // computed over those rather than over every returned loan.
  const judged = (records ?? []).filter((r) => r.return_date && r.due_date);
  const onTime = judged.filter((r) => new Date(r.return_date!) <= new Date(r.due_date!)).length;
  const pct = judged.length ? Math.round((onTime / judged.length) * 100) : null;

  return (
    <>
      {picked ? (
        <div className="picked-box">
          <div>
            <div className="title">
              <Link className="row-link" href={`/staff/borrowers/${picked.borrower_id}`}>
                {picked.first_name} {picked.last_name}
              </Link>
            </div>
            <div className="sub">
              {picked.borrower_id} · {picked.national_id_masked}
              {picked.phone ? ` · โทร ${picked.phone}` : ''}
            </div>
          </div>
          <button className="btn btn-sm btn-outline" onClick={() => setPicked(null)}>
            เปลี่ยน
          </button>
        </div>
      ) : (
        <BorrowerSearch onPick={setPicked} />
      )}

      {picked && records !== null && (
        <>
          {pct !== null && (
            <div className="stat-inline">
              คืนตรงเวลา <strong>{pct}%</strong> ({onTime}/{judged.length} รายการที่มีกำหนดคืน)
            </div>
          )}
          <RecordList records={records} />
        </>
      )}
      {picked && records === null && <div className="empty-state">กำลังโหลด...</div>}
    </>
  );
}

function EquipmentHistory() {
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [selected, setSelected] = useState<Equipment | null>(null);
  const [records, setRecords] = useState<LoanRecord[] | null>(null);

  useEffect(() => {
    api<{ equipment: Equipment[] }>('/api/equipment')
      .then((d) => setEquipment(d.equipment))
      .catch((e) => toast.error(e instanceof Error ? e.message : 'โหลดรายการอุปกรณ์ไม่สำเร็จ'));
  }, []);

  useEffect(() => {
    if (!selected) return;
    setRecords(null);
    api<{ records: LoanRecord[] }>(`/api/records?equipment_id=${encodeURIComponent(selected.equipment_id)}`)
      .then((d) => setRecords(d.records))
      .catch((e) => {
        setRecords([]);
        toast.error(e instanceof Error ? e.message : 'โหลดประวัติไม่สำเร็จ');
      });
  }, [selected]);

  return (
    <>
      <div className="field">
        <label htmlFor="hist_eq">เลือกอุปกรณ์</label>
        <select
          id="hist_eq"
          value={selected?.equipment_id ?? ''}
          onChange={(e) =>
            setSelected(equipment.find((x) => x.equipment_id === e.target.value) ?? null)
          }
        >
          <option value="">-- เลือกอุปกรณ์ --</option>
          {equipment.map((e) => (
            <option key={e.equipment_id} value={e.equipment_id}>
              {e.name}
            </option>
          ))}
        </select>
      </div>

      {selected &&
        (records === null ? (
          <div className="empty-state">กำลังโหลด...</div>
        ) : (
          <RecordList records={records} />
        ))}
    </>
  );
}

function AuditLog() {
  const [entries, setEntries] = useState<AuditEntry[] | null>(null);

  useEffect(() => {
    api<{ audit_log: AuditEntry[] }>('/api/audit-log?limit=200')
      .then((d) => setEntries(d.audit_log))
      .catch((e) => {
        setEntries([]);
        toast.error(e instanceof Error ? e.message : 'โหลด audit log ไม่สำเร็จ');
      });
  }, []);

  if (entries === null) return <div className="empty-state">กำลังโหลด...</div>;
  if (entries.length === 0) return <div className="empty-state">ยังไม่มีประวัติการกระทำ</div>;

  return (
    <div className="list">
      {entries.map((l) => (
        <Link className="list-row clickable" key={l.log_id} href={`/staff/audit/${l.log_id}`}>
          <div>
            <div className="title">{actionLabel(l.action)}</div>
            <div className="sub">
              {l.actor_name} · {thDateTime(l.at)}
              {l.target_id ? ` · ${l.target_type} ${l.target_id}` : ''}
            </div>
          </div>
          <ChevronRight size={16} className="stat-arrow" style={{ flexShrink: 0 }} />
        </Link>
      ))}
    </div>
  );
}
