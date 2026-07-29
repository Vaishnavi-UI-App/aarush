interface StatusCount {
  status: string;
  count: number;
}

const STATUS_COLOR: Record<string, string> = {
  DRAFT: "var(--dd-status-draft)",
  SENT: "var(--dd-status-sent)",
  PARTIALLY_PAID: "var(--dd-status-partial)",
  PAID: "var(--dd-status-paid)",
  OVERDUE: "var(--dd-status-overdue)",
};

const STATUS_LABEL: Record<string, string> = {
  DRAFT: "Draft",
  SENT: "Sent",
  PARTIALLY_PAID: "Partially Paid",
  PAID: "Paid",
  OVERDUE: "Overdue",
};

const WIDTH = 420;
const HEIGHT = 220;
const PAD_LEFT = 34;
const PAD_RIGHT = 10;
const PAD_TOP = 12;
const PAD_BOTTOM = 28;

export default function InvoiceStatusChart({ data }: { data: StatusCount[] }) {
  const rows = data.filter((d) => STATUS_COLOR[d.status]);
  const max = Math.max(1, ...rows.map((d) => d.count));
  const niceMax = Math.max(1, Math.ceil(max / 5) * 5);

  const plotW = WIDTH - PAD_LEFT - PAD_RIGHT;
  const plotH = HEIGHT - PAD_TOP - PAD_BOTTOM;
  const slot = plotW / rows.length;
  const barWidth = Math.min(40, slot * 0.5);

  const y = (v: number) => PAD_TOP + plotH - (v / niceMax) * plotH;
  const steps = 4;

  if (rows.every((r) => r.count === 0)) {
    return <div className="dd-empty">No invoices yet.</div>;
  }

  return (
    <div>
      <div className="dd-legend">
        {rows.map((r) => (
          <span className="dd-legend-item" key={r.status}>
            <span className="dd-legend-swatch" style={{ background: STATUS_COLOR[r.status] }} />
            {STATUS_LABEL[r.status]}
          </span>
        ))}
      </div>
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} width="100%" role="img" aria-label="Invoice status overview">
        {Array.from({ length: steps + 1 }, (_, i) => {
          const value = (niceMax / steps) * i;
          const yy = y(value);
          return (
            <g key={i}>
              <line x1={PAD_LEFT} y1={yy} x2={WIDTH - PAD_RIGHT} y2={yy} className="dd-gridline" />
              <text x={PAD_LEFT - 8} y={yy + 3} textAnchor="end" className="dd-axis-label">
                {value.toFixed(0)}
              </text>
            </g>
          );
        })}

        {rows.map((r, i) => {
          const barH = (r.count / niceMax) * plotH;
          const cx = PAD_LEFT + slot * i + slot / 2;
          const barX = cx - barWidth / 2;
          const barY = PAD_TOP + plotH - barH;
          return (
            <g key={r.status}>
              <rect
                x={barX}
                y={barY}
                width={barWidth}
                height={Math.max(barH, 2)}
                rx="4"
                style={{ fill: STATUS_COLOR[r.status] }}
              >
                <title>{`${STATUS_LABEL[r.status]}: ${r.count}`}</title>
              </rect>
              <text x={cx} y={HEIGHT - 8} textAnchor="middle" className="dd-axis-label">
                {STATUS_LABEL[r.status]}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
