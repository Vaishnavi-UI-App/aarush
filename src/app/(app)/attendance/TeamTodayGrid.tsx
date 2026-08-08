"use client";

import { useEffect, useState } from "react";

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

function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

function currentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
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
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
        <button type="button" onClick={() => setMonth((m) => shiftMonth(m, -1))} className="afs-btn" style={{ background: "#e5e7eb", color: "#333", padding: "4px 12px" }}>
          ← Prev
        </button>
        <div style={{ fontSize: 13, fontWeight: 600, minWidth: 90, textAlign: "center" }}>{month}</div>
        <button type="button" onClick={() => setMonth((m) => shiftMonth(m, 1))} className="afs-btn" style={{ background: "#e5e7eb", color: "#333", padding: "4px 12px" }}>
          Next →
        </button>
        <div style={{ display: "flex", gap: 12, marginLeft: "auto", fontSize: 11, color: "#667", flexWrap: "wrap" }}>
          {Object.entries(HEATMAP_COLOR).map(([status, color]) => (
            <span key={status} style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <span style={{ width: 9, height: 9, borderRadius: 2, background: color, display: "inline-block" }} />
              {status.replace("_", " ")}
            </span>
          ))}
        </div>
      </div>

      {loading || !data ? (
        <div className="afs-empty">Loading…</div>
      ) : data.staff.length === 0 ? (
        <div className="afs-empty">No staff yet.</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {data.staff.map((s) => (
            <div key={s.id} className="afs-card" style={{ padding: 14 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10, marginBottom: 10 }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 13.5 }}>{s.name || s.email}</div>
                  <div style={{ fontSize: 11.5, color: "#889" }}>{s.email}</div>
                </div>
                {s.today ? (
                  <div style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 12.5 }}>
                    <span className={`att-status-pill att-status-pill-${s.today.status.toLowerCase()}`}>{s.today.status.replace("_", " ")}</span>
                    {s.today.isLate && <span className="att-flag">LATE</span>}
                    {s.today.onBreak && <span className="att-flag">ON BREAK</span>}
                    <span style={{ color: "#667" }}>
                      {s.today.checkInAt ? new Date(s.today.checkInAt).toLocaleTimeString("en-IN") : "—"}
                      {" → "}
                      {s.today.checkOutAt ? new Date(s.today.checkOutAt).toLocaleTimeString("en-IN") : s.today.isOpen ? "still in" : "—"}
                    </span>
                  </div>
                ) : (
                  <span className="att-status-pill att-status-pill-absent">No check-in today</span>
                )}
              </div>

              <div style={{ display: "flex", gap: 3, flexWrap: "wrap" }}>
                {data.days.map((d) => {
                  const status = s.byDate[d];
                  const color = status ? HEATMAP_COLOR[status] : "#eef0f6";
                  return <div key={d} title={`${d}: ${status ? status.replace("_", " ") : "no record"}`} style={{ width: 12, height: 12, borderRadius: 3, background: color }} />;
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
