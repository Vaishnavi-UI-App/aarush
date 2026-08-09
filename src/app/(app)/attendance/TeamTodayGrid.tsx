"use client";

import { useEffect, useState } from "react";
import { ClockIcon, ChevronLeftIcon, ChevronRightIcon, ChevronDoubleLeftIcon, ChevronDoubleRightIcon } from "@/components/icons";

interface TodayStatus {
  recordId: string;
  status: string;
  checkInAt: string | null;
  checkOutAt: string | null;
  isLate: boolean;
  isOpen: boolean;
  onBreak: boolean;
}

interface StaffRow {
  id: string;
  name: string | null;
  email: string;
  today: TodayStatus | null;
  byDate: Record<string, string | null>;
}

interface TeamResponse {
  month: string;
  days: string[];
  staff: StaffRow[];
}

const HEATMAP_COLOR: Record<string, string> = {
  PRESENT: "#189a4b",
  ABSENT: "#d0342c",
  HALF_DAY: "#c9860e",
  LEAVE: "#2a5fd6",
  HOLIDAY: "#c7cbd6",
};

const LEGEND_LABEL: Record<string, string> = {
  PRESENT: "Present",
  ABSENT: "Absent",
  HALF_DAY: "Half Day",
  LEAVE: "Leave",
  HOLIDAY: "Holiday",
};

// Reuses the same badge tones as .afs-badge-* elsewhere in the app so avatar colors
// read as part of the same design system rather than a one-off palette.
const AVATAR_PALETTE = [
  { bg: "#dbeafe", color: "#1e40af" },
  { bg: "#dcfce7", color: "#14532d" },
  { bg: "#fbeed9", color: "#a3620f" },
  { bg: "#fbe4e2", color: "#a13a3a" },
  { bg: "#e0e7ff", color: "#3730a3" },
  { bg: "#f7edd0", color: "#8a6d13" },
];

function avatarFor(id: string, label: string) {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  const palette = AVATAR_PALETTE[hash % AVATAR_PALETTE.length];
  const initials = label
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");
  return { ...palette, initials: initials || "?" };
}

function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

function currentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString("en-IN", { month: "long", year: "numeric", timeZone: "UTC" });
}

export default function TeamTodayGrid() {
  const [month, setMonth] = useState(currentMonth());
  const [data, setData] = useState<TeamResponse | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/attendance/admin/team?month=${month}`)
      .then((res) => res.json())
      .then((d) => setData(d))
      .finally(() => setLoading(false));
  }, [month]);

  return (
    <div>
      <div className="att-team-toolbar">
        <div className="att-team-nav">
          <button type="button" onClick={() => setMonth((m) => shiftMonth(m, -12))} title="Previous year" className="att-team-nav-btn">
            <ChevronDoubleLeftIcon />
          </button>
          <button type="button" onClick={() => setMonth((m) => shiftMonth(m, -1))} title="Previous month" className="att-team-nav-btn">
            <ChevronLeftIcon />
          </button>
          <div className="att-team-month">{monthLabel(month)}</div>
          <button type="button" onClick={() => setMonth((m) => shiftMonth(m, 1))} title="Next month" className="att-team-nav-btn">
            <ChevronRightIcon />
          </button>
          <button type="button" onClick={() => setMonth((m) => shiftMonth(m, 12))} title="Next year" className="att-team-nav-btn">
            <ChevronDoubleRightIcon />
          </button>
        </div>

        <div className="att-team-legend">
          {Object.entries(HEATMAP_COLOR).map(([status, color]) => (
            <span key={status} className="att-team-legend-item">
              <span className="att-team-legend-dot" style={{ background: color }} />
              {LEGEND_LABEL[status]}
            </span>
          ))}
        </div>
      </div>

      {loading || !data ? (
        <div className="afs-empty">Loading…</div>
      ) : data.staff.length === 0 ? (
        <div className="afs-empty">No staff yet.</div>
      ) : (
        <div className="att-team-grid">
          {data.staff.map((s) => {
            const label = s.name || s.email;
            const avatar = avatarFor(s.id, label);
            return (
              <div key={s.id} className="att-team-card">
                <div className="att-team-card-top">
                  <div className="att-team-person">
                    <div className="att-team-avatar" style={{ background: avatar.bg, color: avatar.color }}>
                      {avatar.initials}
                    </div>
                    <div>
                      <div className="att-team-name">{label}</div>
                      <div className="att-team-email">{s.email}</div>
                    </div>
                  </div>

                  {s.today ? (
                    <div className="att-team-status">
                      <span className={`att-status-pill att-status-pill-${s.today.status.toLowerCase()}`}>{s.today.status.replace("_", " ")}</span>
                      {s.today.isLate && <span className="att-flag">LATE</span>}
                      {s.today.onBreak && <span className="att-flag">ON BREAK</span>}
                    </div>
                  ) : (
                    <span className="att-team-nocheckin">
                      <ClockIcon /> No check-in today
                    </span>
                  )}
                </div>

                {s.today && (
                  <div className="att-team-times">
                    {s.today.checkInAt ? new Date(s.today.checkInAt).toLocaleTimeString("en-IN") : "—"}
                    {" → "}
                    {s.today.checkOutAt ? new Date(s.today.checkOutAt).toLocaleTimeString("en-IN") : s.today.isOpen ? "still in" : "—"}
                  </div>
                )}

                <div className="att-team-heatmap">
                  {data.days.map((d) => {
                    const status = s.byDate[d];
                    const color = status ? HEATMAP_COLOR[status] : "#eef0f6";
                    return <div key={d} title={`${d}: ${status ? status.replace("_", " ") : "no record"}`} className="att-team-heatmap-cell" style={{ background: color }} />;
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
