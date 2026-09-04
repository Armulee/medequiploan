'use client';

import { useCallback, useEffect, useState } from 'react';
import Alert from '@/components/Alert';
import { api } from '@/app/lib/api';
import { statusBadgeClass, thDate, thDateTime } from '@/app/lib/format';
import BorrowerSearch from './BorrowerSearch';
import type { AuditEntry, BorrowerListItem, Equipment, LoanRecord } from '@/app/lib/types';

type SubTab = 'borrower' | 'equipment' | 'audit';

const ACTION_LABELS: Record<string, string> = {
  login: 'เข้าสู่ระบบ',
  logout: 'ออกจากระบบ',
  borrow: 'ยืมอุปกรณ์',
  return: 'รับคืนอุปกรณ์',
  register_borrower: 'ลงทะเบียนผู้ยืม',
  self_register_borrower: 'ผู้ใช้ลงทะเบียนเอง',
  submit_request: 'ส่งคำขอยืม',
  approve_request: 'อนุมัติคำขอ',
  reject_request: 'ปฏิเสธคำขอ',
  create_equipment: 'เพิ่มอุปกรณ์',
  update_equipment: 'แก้ไขอุปกรณ์',
  adjust_stock: 'ตัดสต็อก',
};

export default function HistoryTab() {
  const [sub, setSub] = useState<SubTab>('borrower');

  return (
    <div className="card">
      <h1>ประวัติการใช้งาน</h1>
      <div className="filter-row">
        <button
          className={`btn btn-sm ${sub === 'borrower' ? 'btn-primary' : 'btn-outline'}`}
          onClick={() => setSub('borrower')}
        >
          ประวัติผู้ยืม
        </button>
        <button
          className={`btn btn-sm ${sub === 'equipment' ? 'btn-primary' : 'btn-outline'}`}
          onClick={() => setSub('equipment')}
        >
          ประวัติอุปกรณ์
        </button>
        <button
          className={`btn btn-sm ${sub === 'audit' ? 'btn-primary' : 'btn-outline'}`}
          onClick={() => setSub('audit')}
        >
          Audit Log
        </button>
      </div>

      {sub === 'borrower' && <BorrowerHistory />}
      {sub === 'equipment' && <EquipmentHistory />}
      {sub === 'audit' && <AuditLog />}
    </div>
  );
}

function RecordList({ records }: { records: LoanRecord[] }) {
  if (records.length === 0) return <div className="empty-state">ยังไม่มีประวัติการยืม</div>;
  return (
    <div className="list">
      {records.map((r) => (
        <div className="list-row" key={r.record_id}>
          <div>
            <div className="title">{r.equipment_name}</div>
            <div className="sub">
              {r.borrower_name} · ยืม {thDate(r.borrow_date)}
              {r.due_date ? ` · ครบกำหนด ${thDate(r.due_date)}` : ''}
              {r.return_date ? ` · คืน ${thDate(r.return_date)}` : ''}
              {r.condition_on_return ? ` · สภาพ: ${r.condition_on_return}` : ''}
            </div>
          </div>
          <span className={statusBadgeClass(r.status)}>{r.status}</span>
        </div>
      ))}
    </div>
  );
}

function BorrowerHistory() {
  const [picked, setPicked] = useState<BorrowerListItem | null>(null);
  const [records, setRecords] = useState<LoanRecord[] | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!picked) return;
    setRecords(null);
    api<{ records: LoanRecord[] }>(`/api/records?borrower_id=${encodeURIComponent(picked.borrower_id)}`)
      .then((d) => setRecords(d.records))
      .catch((e) => setError(e instanceof Error ? e.message : 'โหลดประวัติไม่สำเร็จ'));
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
              {picked.first_name} {picked.last_name}
            </div>
            <div className="sub">
              {picked.borrower_id} · {picked.national_id_masked}
            </div>
          </div>
          <button className="btn btn-sm btn-outline" onClick={() => setPicked(null)}>
            เปลี่ยน
          </button>
        </div>
      ) : (
        <BorrowerSearch onPick={setPicked} />
      )}

      <Alert kind="error">{error}</Alert>

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
    </>
  );
}

function EquipmentHistory() {
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [selected, setSelected] = useState<Equipment | null>(null);
  const [records, setRecords] = useState<LoanRecord[] | null>(null);

  useEffect(() => {
    api<{ equipment: Equipment[] }>('/api/equipment').then((d) => setEquipment(d.equipment)).catch(() => {});
  }, []);

  useEffect(() => {
    if (!selected) return;
    setRecords(null);
    api<{ records: LoanRecord[] }>(`/api/records?equipment_id=${encodeURIComponent(selected.equipment_id)}`)
      .then((d) => setRecords(d.records))
      .catch(() => setRecords([]));
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

      {selected && (records === null ? <div className="empty-state">กำลังโหลด...</div> : <RecordList records={records} />)}
    </>
  );
}

function AuditLog() {
  const [entries, setEntries] = useState<AuditEntry[] | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    api<{ audit_log: AuditEntry[] }>('/api/audit-log?limit=200')
      .then((d) => setEntries(d.audit_log))
      .catch((e) => setError(e instanceof Error ? e.message : 'โหลด audit log ไม่สำเร็จ'));
  }, []);

  useEffect(load, [load]);

  return (
    <>
      <Alert kind="error">{error}</Alert>
      {entries === null ? (
        <div className="empty-state">กำลังโหลด...</div>
      ) : entries.length === 0 ? (
        <div className="empty-state">ยังไม่มีประวัติการกระทำ</div>
      ) : (
        <div className="list">
          {entries.map((l) => (
            <div className="list-row" key={l.log_id}>
              <div>
                <div className="title">{ACTION_LABELS[l.action] ?? l.action}</div>
                <div className="sub">
                  {l.actor_name} · {thDateTime(l.at)}
                  {l.target_id ? ` · ${l.target_type} ${l.target_id}` : ''}
                  {l.details ? ` · ${l.details}` : ''}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
