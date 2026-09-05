import { sql } from 'drizzle-orm';
import { db, rowsOf } from '@/lib/db';
import { json, requireAuth, route } from '@/lib/api';

/**
 * Every figure is computed in SQL rather than by pulling whole tables into the
 * function and counting there, so the dashboard stays a handful of small
 * queries no matter how long the system has been running.
 */
export const GET = route(async () => {
  await requireAuth();

  const [summary, lowStock, overdue, monthly] = await Promise.all([
    db.execute(sql`
      SELECT
        (SELECT count(*) FROM records WHERE status <> 'คืนแล้ว')                         AS active_loans,
        (SELECT count(*) FROM records
          WHERE status <> 'คืนแล้ว' AND due_date IS NOT NULL AND due_date < now())        AS overdue_loans,
        (SELECT count(*) FROM requests WHERE status = 'รอดำเนินการ')                      AS pending_requests,
        (SELECT count(*) FROM equipment WHERE available_qty <= low_stock_threshold)       AS low_stock_items,
        (SELECT count(*) FROM borrowers)                                                  AS total_borrowers,
        (SELECT coalesce(sum(total_qty), 0) FROM equipment)                               AS total_equipment
    `),
    db.execute(sql`
      SELECT equipment_id, name, available_qty, total_qty, low_stock_threshold
        FROM equipment
       WHERE available_qty <= low_stock_threshold
       ORDER BY available_qty ASC, name ASC
       LIMIT 10
    `),
    db.execute(sql`
      SELECT r.record_id, r.due_date, b.first_name, b.last_name, e.name AS equipment_name,
             EXTRACT(DAY FROM now() - r.due_date)::int AS days_overdue
        FROM records r
        LEFT JOIN borrowers b ON b.borrower_id = r.borrower_id
        LEFT JOIN equipment e ON e.equipment_id = r.equipment_id
       WHERE r.status <> 'คืนแล้ว' AND r.due_date IS NOT NULL AND r.due_date < now()
       ORDER BY r.due_date ASC
       LIMIT 10
    `),
    // Last 6 months including the current one, with zero-filled gaps so the
    // chart doesn't skip a quiet month.
    db.execute(sql`
      WITH months AS (
        SELECT generate_series(
          date_trunc('month', now()) - interval '5 months',
          date_trunc('month', now()),
          interval '1 month'
        ) AS month
      )
      SELECT to_char(m.month, 'YYYY-MM') AS month,
             count(r.record_id)::int      AS borrows
        FROM months m
        LEFT JOIN records r
          ON date_trunc('month', r.borrow_date) = m.month
       GROUP BY m.month
       ORDER BY m.month
    `),
  ]);

  const s = rowsOf<Record<string, unknown>>(summary)[0] ?? {};
  const num = (v: unknown) => Number(v ?? 0);

  return json({
    summary: {
      active_loans: num(s.active_loans),
      overdue_loans: num(s.overdue_loans),
      pending_requests: num(s.pending_requests),
      low_stock_items: num(s.low_stock_items),
      total_borrowers: num(s.total_borrowers),
      total_equipment: num(s.total_equipment),
    },
    low_stock: rowsOf<Record<string, unknown>>(lowStock).map((r) => ({
      equipment_id: String(r.equipment_id),
      name: String(r.name),
      available_qty: num(r.available_qty),
      total_qty: num(r.total_qty),
      low_stock_threshold: num(r.low_stock_threshold),
    })),
    overdue: rowsOf<Record<string, unknown>>(overdue).map((r) => ({
      record_id: String(r.record_id),
      due_date: r.due_date as string,
      borrower_name: r.first_name ? `${r.first_name} ${r.last_name}` : '-',
      equipment_name: String(r.equipment_name ?? '-'),
      days_overdue: num(r.days_overdue),
    })),
    monthly: rowsOf<Record<string, unknown>>(monthly).map((r) => ({
      month: String(r.month),
      borrows: num(r.borrows),
    })),
  });
});
