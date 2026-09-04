'use client';

/**
 * Six-month borrow volume. One series, so no legend — the heading names it.
 *
 * The brand orange measures 2.83:1 against a white surface, under the 3:1 the
 * palette check wants, so every column carries a visible value label as the
 * required relief rather than leaning on the fill alone. With six columns that
 * is still sparse enough to read.
 */
const TH_MONTHS = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];

function monthLabel(ym: string): string {
  const [y, m] = ym.split('-').map(Number);
  const be = String((y + 543) % 100).padStart(2, '0');
  return `${TH_MONTHS[m - 1] ?? ym} ${be}`;
}

// Square at the baseline, 4px rounded at the data end.
function columnPath(x: number, y: number, w: number, h: number, r = 4): string {
  const rr = Math.min(r, w / 2, h);
  return `M${x},${y + h} L${x},${y + rr} Q${x},${y} ${x + rr},${y} L${x + w - rr},${y} Q${x + w},${y} ${x + w},${y + rr} L${x + w},${y + h} Z`;
}

export default function MonthlyChart({ data }: { data: Array<{ month: string; borrows: number }> }) {
  if (data.length === 0) return <div className="empty-state">ยังไม่มีข้อมูล</div>;

  const W = 640;
  const H = 220;
  const PAD = { top: 24, right: 12, bottom: 34, left: 40 };
  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;

  const peak = Math.max(...data.map((d) => d.borrows));
  // A flat-zero month range would divide by zero; give it a nominal scale so the
  // axis still renders with an honest empty plot.
  const max = peak > 0 ? Math.ceil(peak / 4) * 4 : 4;
  const ticks = [0, max / 2, max];

  const band = plotW / data.length;
  const GAP = 2; // surface gap between adjacent columns
  const barW = Math.min(24, band - GAP * 2);

  return (
    <figure className="chart-figure">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="จำนวนการยืมรายเดือน 6 เดือนล่าสุด" className="chart-svg">
        {ticks.map((t) => {
          const y = PAD.top + plotH - (t / max) * plotH;
          return (
            <g key={t}>
              <line x1={PAD.left} x2={W - PAD.right} y1={y} y2={y} className="chart-grid" />
              <text x={PAD.left - 8} y={y + 4} textAnchor="end" className="chart-tick">
                {t}
              </text>
            </g>
          );
        })}

        {data.map((d, i) => {
          const h = max > 0 ? (d.borrows / max) * plotH : 0;
          const x = PAD.left + i * band + (band - barW) / 2;
          const y = PAD.top + plotH - h;
          return (
            <g key={d.month}>
              {h > 0 && (
                <>
                  <path d={columnPath(x, y, barW, h)} className="chart-bar" />
                  <text x={x + barW / 2} y={y - 7} textAnchor="middle" className="chart-value">
                    {d.borrows}
                  </text>
                </>
              )}
              <text x={x + barW / 2} y={H - 12} textAnchor="middle" className="chart-tick">
                {monthLabel(d.month)}
              </text>
              <title>
                {monthLabel(d.month)}: ยืม {d.borrows} ครั้ง
              </title>
            </g>
          );
        })}
      </svg>
    </figure>
  );
}
