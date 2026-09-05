'use client';

import { ChevronRight, TriangleAlert } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { api } from '@/app/lib/api';
import { thDate } from '@/app/lib/format';
import { ListCount } from './InfiniteList';
import MonthlyChart from './MonthlyChart';

type Dashboard = {
  summary: {
    active_loans: number;
    overdue_loans: number;
    pending_requests: number;
    low_stock_items: number;
    total_borrowers: number;
    total_equipment: number;
  };
  low_stock: Array<{ equipment_id: string; name: string; available_qty: number; total_qty: number }>;
  overdue: Array<{
    record_id: string;
    due_date: string;
    borrower_name: string;
    equipment_name: string;
    days_overdue: number;
  }>;
  monthly: Array<{ month: string; borrows: number }>;
};

export default function DashboardTab() {
  const [data, setData] = useState<Dashboard | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    api<Dashboard>('/api/dashboard')
      .then(setData)
      .catch((e) => {
        setFailed(true);
        toast.error(e instanceof Error ? e.message : 'โหลดข้อมูลภาพรวมไม่สำเร็จ');
      });
  }, []);

  if (failed) {
    return (
      <div className="card">
        <h1>ภาพรวมระบบ</h1>
        <div className="empty-state">
          โหลดข้อมูลไม่สำเร็จ
          <div style={{ marginTop: 10 }}>
            <button className="btn btn-sm btn-outline" onClick={() => location.reload()}>
              ลองอีกครั้ง
            </button>
          </div>
        </div>
      </div>
    );
  }
  if (!data) return <div className="card"><div className="empty-state">กำลังโหลด...</div></div>;

  const s = data.summary;

  return (
    <>
      <div className="card">
        <h1>ภาพรวมระบบ</h1>

        {/* Each tile opens the list it counts, already filtered — the number
            on its own only ever prompts the question "which ones?" */}
        <div className="stat-row">
          <StatTile label="กำลังยืมอยู่" value={s.active_loans} unit="รายการ" href="/staff/returns" />
          <StatTile
            label="เกินกำหนดคืน"
            value={s.overdue_loans}
            unit="รายการ"
            tone={s.overdue_loans > 0 ? 'danger' : undefined}
            href="/staff/returns?filter=overdue"
          />
          <StatTile
            label="คำขอรออนุมัติ"
            value={s.pending_requests}
            unit="คำขอ"
            tone={s.pending_requests > 0 ? 'warn' : undefined}
            href="/staff/requests?status=รอดำเนินการ"
          />
          <StatTile
            label="อุปกรณ์ใกล้หมด"
            value={s.low_stock_items}
            unit="รายการ"
            tone={s.low_stock_items > 0 ? 'warn' : undefined}
            href="/staff/stock?low=1"
          />
        </div>

        <div className="stat-row" style={{ marginTop: 10 }}>
          <StatTile label="ผู้ยืมที่ลงทะเบียน" value={s.total_borrowers} unit="คน" />
          <StatTile label="อุปกรณ์ทั้งหมด" value={s.total_equipment} unit="ชิ้น" />
        </div>
      </div>

      <div className="card">
        <h2>จำนวนการยืมรายเดือน</h2>
        <p style={{ color: 'var(--text-muted)', marginTop: -6 }}>6 เดือนล่าสุด</p>
        <MonthlyChart data={data.monthly} />
      </div>

      <div className="card">
        <h2>
          <TriangleAlert size={18} color="var(--red)" /> เกินกำหนดคืน
        </h2>
        {data.overdue.length === 0 ? (
          <div className="empty-state">ไม่มีรายการเกินกำหนด</div>
        ) : (
          <>
          {/* Deliberately the ten most overdue rather than a paged list — this
              is a summary, and the whole queue is one tap away. */}
          <ListCount shown={data.overdue.length} total={s.overdue_loans} />
          <div className="list">
            {data.overdue.map((o) => (
              <Link
                className="list-row clickable"
                key={o.record_id}
                href={`/staff/records/${o.record_id}`}
              >
                <div>
                  <div className="title">{o.equipment_name}</div>
                  <div className="sub">
                    {o.borrower_name} · ครบกำหนด {thDate(o.due_date)}
                  </div>
                </div>
                <span className="badge badge-overdue">เกิน {o.days_overdue} วัน</span>
              </Link>
            ))}
          </div>
          {data.overdue.length < s.overdue_loans && (
            <div className="list-more">
              <Link href="/staff/returns?filter=overdue">ดูรายการเกินกำหนดทั้งหมด</Link>
            </div>
          )}
          </>
        )}
      </div>

      <div className="card">
        <h2>อุปกรณ์ใกล้หมด</h2>
        {data.low_stock.length === 0 ? (
          <div className="empty-state">สต็อกทุกรายการอยู่ในเกณฑ์ปกติ</div>
        ) : (
          <>
          <ListCount shown={data.low_stock.length} total={s.low_stock_items} />
          <div className="list">
            {data.low_stock.map((e) => (
              <div className="list-row" key={e.equipment_id}>
                <div>
                  <div className="title">{e.name}</div>
                  <div className="sub">
                    คงเหลือ {e.available_qty} จากทั้งหมด {e.total_qty}
                  </div>
                </div>
                <span className="badge badge-low">ใกล้หมด</span>
              </div>
            ))}
          </div>
          {data.low_stock.length < s.low_stock_items && (
            <div className="list-more">
              <Link href="/staff/stock?low=1">ดูอุปกรณ์ใกล้หมดทั้งหมด</Link>
            </div>
          )}
          </>
        )}
      </div>
    </>
  );
}

function StatTile({
  label,
  value,
  unit,
  tone,
  href,
}: {
  label: string;
  value: number;
  unit: string;
  tone?: 'warn' | 'danger';
  href?: string;
}) {
  const className = `stat-tile${tone ? ` stat-${tone}` : ''}`;
  const body = (
    <>
      <div className="stat-label">
        {label}
        {href && <ChevronRight size={15} className="stat-arrow" />}
      </div>
      <div className="stat-value">
        {value.toLocaleString('th-TH')}
        <span className="stat-unit">{unit}</span>
      </div>
    </>
  );

  if (!href) return <div className={className}>{body}</div>;
  return (
    <Link className={className} href={href}>
      {body}
    </Link>
  );
}
