'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import Alert from '@/components/Alert';
import { api } from '@/app/lib/api';
import { statusBadgeClass, thDate, thDateTime } from '@/app/lib/format';
import BorrowerSearch from './BorrowerSearch';
import RecordDetail from './RecordDetail';
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

type Opened = { kind: 'record'; record: LoanRecord } | { kind: 'audit'; entry: AuditEntry };

export default function HistoryTab({ isAdmin }: { isAdmin: boolean }) {
  const [sub, setSub] = useState<SubTab>('borrower');
  // Held here rather than inside each sub-tab so an opened row REPLACES the
  // tab instead of rendering a card inside the tab's own card.
  const [open, setOpen] = useState<Opened | null>(null);

  if (open?.kind === 'record') {
    return <RecordDetail record={open.record} onBack={() => setOpen(null)} />;
  }
  if (open?.kind === 'audit') {
    return <AuditDetail entry={open.entry} onBack={() => setOpen(null)} />;
  }

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
        {/* Names who did what to whose record — oversight, not everyday use. */}
        {isAdmin && (
          <button
            className={`btn btn-sm ${sub === 'audit' ? 'btn-primary' : 'btn-outline'}`}
            onClick={() => setSub('audit')}
          >
            Audit Log
          </button>
        )}
      </div>

      {sub === 'borrower' && (
        <BorrowerHistory onOpen={(record) => setOpen({ kind: 'record', record })} />
      )}
      {sub === 'equipment' && (
        <EquipmentHistory onOpen={(record) => setOpen({ kind: 'record', record })} />
      )}
      {sub === 'audit' && isAdmin && (
        <AuditLog onOpen={(entry) => setOpen({ kind: 'audit', entry })} />
      )}
    </div>
  );
}

function RecordList({
  records,
  onOpen,
}: {
  records: LoanRecord[];
  onOpen: (r: LoanRecord) => void;
}) {
  if (records.length === 0) return <div className="empty-state">ยังไม่มีประวัติการยืม</div>;
  return (
    <div className="list">
      {records.map((r) => (
        <button className="list-row clickable" key={r.record_id} onClick={() => onOpen(r)}>
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
        </button>
      ))}
    </div>
  );
}

function BorrowerHistory({ onOpen }: { onOpen: (r: LoanRecord) => void }) {
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

      <Alert kind="error">{error}</Alert>

      {picked && records !== null && (
        <>
          {pct !== null && (
            <div className="stat-inline">
              คืนตรงเวลา <strong>{pct}%</strong> ({onTime}/{judged.length} รายการที่มีกำหนดคืน)
            </div>
          )}
          <RecordList records={records} onOpen={onOpen} />
        </>
      )}
    </>
  );
}

function EquipmentHistory({ onOpen }: { onOpen: (r: LoanRecord) => void }) {
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

      {selected &&
        (records === null ? (
          <div className="empty-state">กำลังโหลด...</div>
        ) : (
          <RecordList records={records} onOpen={onOpen} />
        ))}
    </>
  );
}

function AuditLog({ onOpen }: { onOpen: (e: AuditEntry) => void }) {
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
            <button className="list-row clickable" key={l.log_id} onClick={() => onOpen(l)}>
              <div>
                <div className="title">{ACTION_LABELS[l.action] ?? l.action}</div>
                <div className="sub">
                  {l.actor_name} · {thDateTime(l.at)}
                  {l.target_id ? ` · ${l.target_type} ${l.target_id}` : ''}
                </div>
              </div>
              <ChevronRight size={16} className="stat-arrow" style={{ flexShrink: 0 }} />
            </button>
          ))}
        </div>
      )}
    </>
  );
}

/** One audit line in full: the list has to stay scannable, this does not. */
function AuditDetail({ entry, onBack }: { entry: AuditEntry; onBack: () => void }) {
  return (
    <>
      <button className="back-link" onClick={onBack}>
        <ChevronLeft size={20} strokeWidth={2.5} />
        กลับ
      </button>

      <div className="card">
        <div className="card-head">
          <h1>{ACTION_LABELS[entry.action] ?? entry.action}</h1>
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
