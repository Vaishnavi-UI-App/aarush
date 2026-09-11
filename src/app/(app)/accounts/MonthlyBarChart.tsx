"use client";

export interface MonthPoint {
  /** "YYYY-MM" */
  key: string;
  label: string;
  total: number;
}

const WIDTH = 800;
const HEIGHT = 220;
const PAD_LEFT = 64;
const PAD_RIGHT = 12;
const PAD_TOP = 14;
const PAD_BOTTOM = 30;

/** Compact axis labels -- a year of sales in rupees runs to 8 digits, which won't
 * fit on a tick otherwise. */
function shortMoney(n: number): string {
  if (n >= 10000000) return `${(n / 10000000).toFixed(n >= 100000000 ? 0 : 1)}Cr`;
  if (n >= 100000) return `${(n / 100000).toFixed(n >= 1000000 ? 0 : 1)}L`;
  if (n >= 1000) return `${Math.round(n / 1000)}K`;
  return String(Math.round(n));
}

function fullMoney(n: number): string {
  return n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function MonthlyBarChart({ data, emptyLabel, ariaLabel }: { data: MonthPoint[]; emptyLabel: string; ariaLabel: string }) {
  if (data.length === 0 || data.every((d) => d.total === 0)) {
    return <div className="afs-empty">{emptyLabel}</div>;
  }

  const plotW = WIDTH - PAD_LEFT - PAD_RIGHT;
  const plotH = HEIGHT - PAD_TOP - PAD_BOTTOM;
  const max = Math.max(...data.map((d) => d.total));
  // Round the axis up to something readable rather than ending on an odd figure.
  const magnitude = Math.pow(10, Math.floor(Math.log10(max)));
  const niceMax = Math.ceil(max / (magnitude / 2)) * (magnitude / 2);
  const slot = plotW / data.length;
  const barWidth = Math.min(42, slot * 0.6);
  const y = (v: number) => PAD_TOP + plotH - (v / niceMax) * plotH;
  const steps = 4;
  // With many months, printing every label overlaps -- thin them out evenly.
  const labelEvery = Math.ceil(data.length / 12);

  return (
    <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} width="100%" role="img" aria-label={ariaLabel}>
      {Array.from({ length: steps + 1 }, (_, i) => {
        const value = (niceMax / steps) * i;
        const yy = y(value);
        return (
          <g key={i}>
            <line x1={PAD_LEFT} y1={yy} x2={WIDTH - PAD_RIGHT} y2={yy} stroke="#e6e9f2" strokeWidth="1" />
            <text x={PAD_LEFT - 8} y={yy + 3} textAnchor="end" fontSize="10" fill="#99a1b0">
              {shortMoney(value)}
            </text>
          </g>
        );
      })}

      {data.map((d, i) => {
        const cx = PAD_LEFT + slot * i + slot / 2;
        const barH = (d.total / niceMax) * plotH;
        const barY = PAD_TOP + plotH - barH;
        return (
          <g key={d.key}>
            <rect x={cx - barWidth / 2} y={barY} width={barWidth} height={Math.max(barH, 1)} rx="3" fill="#2a5fd6">
              <title>{`${d.label}: Rs. ${fullMoney(d.total)}`}</title>
            </rect>
            {i % labelEvery === 0 && (
              <text x={cx} y={HEIGHT - 10} textAnchor="middle" fontSize="10" fill="#99a1b0">
                {d.label}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}
