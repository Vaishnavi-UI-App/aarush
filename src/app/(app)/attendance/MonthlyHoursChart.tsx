interface DayPoint {
  date: string;
  hours: number;
  overtimeHours: number;
}

const WIDTH = 640;
const HEIGHT = 200;
const PAD_LEFT = 34;
const PAD_RIGHT = 10;
const PAD_TOP = 12;
const PAD_BOTTOM = 24;

export default function MonthlyHoursChart({ data }: { data: DayPoint[] }) {
  if (data.length === 0 || data.every((d) => d.hours === 0)) {
    return <div className="afs-empty">No hours logged this month.</div>;
  }

  const plotW = WIDTH - PAD_LEFT - PAD_RIGHT;
  const plotH = HEIGHT - PAD_TOP - PAD_BOTTOM;
  const max = Math.max(1, ...data.map((d) => d.hours));
  const niceMax = Math.max(4, Math.ceil(max / 2) * 2);
  const slot = plotW / data.length;
  const barWidth = Math.min(18, slot * 0.6);
  const y = (v: number) => PAD_TOP + plotH - (v / niceMax) * plotH;
  const steps = 4;

  return (
    <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} width="100%" role="img" aria-label="Daily hours worked this month">
      {Array.from({ length: steps + 1 }, (_, i) => {
        const value = (niceMax / steps) * i;
        const yy = y(value);
        return (
          <g key={i}>
            <line x1={PAD_LEFT} y1={yy} x2={WIDTH - PAD_RIGHT} y2={yy} stroke="#e6e9f2" strokeWidth="1" />
            <text x={PAD_LEFT - 8} y={yy + 3} textAnchor="end" fontSize="10" fill="#99a1b0">
              {value}
            </text>
          </g>
        );
      })}

      {data.map((d, i) => {
        const cx = PAD_LEFT + slot * i + slot / 2;
        const barX = cx - barWidth / 2;
        const barH = (d.hours / niceMax) * plotH;
        const barY = PAD_TOP + plotH - barH;
        const dayNum = Number(d.date.slice(-2));
        return (
          <g key={d.date}>
            <rect x={barX} y={barY} width={barWidth} height={Math.max(barH, 1)} rx="2" fill={d.overtimeHours > 0 ? "#c99a2e" : "#2a5fd6"}>
              <title>{`${d.date}: ${d.hours.toFixed(2)}h${d.overtimeHours > 0 ? ` (${d.overtimeHours.toFixed(2)}h OT)` : ""}`}</title>
            </rect>
            {dayNum % 5 === 0 && (
              <text x={cx} y={HEIGHT - 8} textAnchor="middle" fontSize="10" fill="#99a1b0">
                {dayNum}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}
