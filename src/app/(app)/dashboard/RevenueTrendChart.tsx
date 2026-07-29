interface Point {
  label: string;
  value: number;
}

const WIDTH = 560;
const HEIGHT = 220;
const PAD_LEFT = 46;
const PAD_RIGHT = 16;
const PAD_TOP = 12;
const PAD_BOTTOM = 28;

export default function RevenueTrendChart({ data }: { data: Point[] }) {
  const plotW = WIDTH - PAD_LEFT - PAD_RIGHT;
  const plotH = HEIGHT - PAD_TOP - PAD_BOTTOM;

  const max = Math.max(1, ...data.map((d) => d.value));
  const niceMax = Math.ceil(max / 1000) * 1000 || 1;
  const steps = 4;

  const x = (i: number) => PAD_LEFT + (data.length > 1 ? (i / (data.length - 1)) * plotW : plotW / 2);
  const y = (v: number) => PAD_TOP + plotH - (v / niceMax) * plotH;

  const linePath = data.map((d, i) => `${i === 0 ? "M" : "L"} ${x(i).toFixed(1)} ${y(d.value).toFixed(1)}`).join(" ");
  const areaPath = `${linePath} L ${x(data.length - 1).toFixed(1)} ${(PAD_TOP + plotH).toFixed(1)} L ${x(0).toFixed(1)} ${(PAD_TOP + plotH).toFixed(1)} Z`;

  if (data.length === 0 || max === 0) {
    return <div className="dd-empty">No revenue yet.</div>;
  }

  return (
    <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} width="100%" role="img" aria-label="Monthly revenue trend">
      <defs>
        <linearGradient id="revenueFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" style={{ stopColor: "var(--dd-series-line)", stopOpacity: 0.3 }} />
          <stop offset="100%" style={{ stopColor: "var(--dd-series-line)", stopOpacity: 0 }} />
        </linearGradient>
      </defs>

      {Array.from({ length: steps + 1 }, (_, i) => {
        const value = (niceMax / steps) * i;
        const yy = y(value);
        return (
          <g key={i}>
            <line x1={PAD_LEFT} y1={yy} x2={WIDTH - PAD_RIGHT} y2={yy} className="dd-gridline" />
            <text x={PAD_LEFT - 8} y={yy + 3} textAnchor="end" className="dd-axis-label">
              {value >= 1000 ? `${(value / 1000).toFixed(0)}k` : value.toFixed(0)}
            </text>
          </g>
        );
      })}

      <path d={areaPath} fill="url(#revenueFill)" stroke="none" />
      <path
        d={linePath}
        fill="none"
        style={{ stroke: "var(--dd-series-line)" }}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {data.map((d, i) => (
        <g key={d.label}>
          <circle cx={x(i)} cy={y(d.value)} r="4" style={{ fill: "var(--dd-card)", stroke: "var(--dd-series-line)" }} strokeWidth="2">
            <title>{`${d.label}: Rs. ${d.value.toFixed(2)}`}</title>
          </circle>
          <text x={x(i)} y={HEIGHT - 8} textAnchor="middle" className="dd-axis-label">
            {d.label}
          </text>
        </g>
      ))}
    </svg>
  );
}
