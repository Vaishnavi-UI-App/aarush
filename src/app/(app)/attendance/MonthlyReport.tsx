"use client";

import { useEffect, useState } from "react";
import { DownloadIcon } from "@/components/icons";
import MonthlyHoursChart from "./MonthlyHoursChart";

interface StaffOption {
  id: string;
  name: string | null;
  email: string;
}

interface MonthlyData {
  user: { id: string; name: string | null; email: string };
  month: string;
  summary: {
    presentDays: number;
    absentDays: number;
    halfDays: number;
    leaveDays: number;
    holidayDays: number;
    lateCount: number;
    totalHours: number;
    overtimeHours: number;
  };
  daily: { date: string; status: string; hours: number; overtimeHours: number; isLate: boolean; isEarlyDeparture: boolean }[];
}

function currentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

export default function MonthlyReport({ staff }: { staff: StaffOption[] }) {
  const [userId, setUserId] = useState(staff[0]?.id ?? "");
  const [month, setMonth] = useState(currentMonth());
  const [data, setData] = useState<MonthlyData | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!userId) return;
    setLoading(true);
    fetch(`/api/attendance/reports/monthly?userId=${userId}&month=${month}`)
      .then((res) => res.json())
      .then((d) => setData(d))
      .finally(() => setLoading(false));
  }, [userId, month]);

  return (
    <div>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end", marginBottom: 16 }}>
        <div className="afs-form-field" style={{ maxWidth: 240 }}>
          <label>Employee</label>
          <select value={userId} onChange={(e) => setUserId(e.target.value)}>
            {staff.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name || s.email}
              </option>
            ))}
          </select>
        </div>
        <div className="afs-form-field" style={{ maxWidth: 160 }}>
          <label>Month</label>
          <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
        </div>
        {userId && (
          <a href={`/api/attendance/reports/monthly?userId=${userId}&month=${month}&format=csv`} className="afs-btn" style={{ background: "#e5e7eb", color: "#333" }}>
            <DownloadIcon /> Export CSV
          </a>
        )}
      </div>

      {loading || !data ? (
        <div className="afs-empty">Loading…</div>
      ) : (
        <>
          <div className="att-stat-grid" style={{ marginBottom: 20 }}>
            <div className="att-stat-card">
              <div>
                <div className="att-stat-label">Present days</div>
                <div className="att-stat-value">{data.summary.presentDays}</div>
              </div>
            </div>
            <div className="att-stat-card">
              <div>
                <div className="att-stat-label">Absent / Half-day</div>
                <div className="att-stat-value">
                  {data.summary.absentDays} / {data.summary.halfDays}
                </div>
              </div>
            </div>
            <div className="att-stat-card">
              <div>
                <div className="att-stat-label">Total hours</div>
                <div className="att-stat-value">{data.summary.totalHours.toFixed(1)}h</div>
              </div>
            </div>
            <div className="att-stat-card">
              <div>
                <div className="att-stat-label">Overtime / Late marks</div>
                <div className="att-stat-value">
                  {data.summary.overtimeHours.toFixed(1)}h / {data.summary.lateCount}
                </div>
              </div>
            </div>
          </div>

          <div className="afs-card" style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>Daily hours</div>
            <MonthlyHoursChart data={data.daily} />
          </div>

          <div className="afs-card">
            {data.daily.length === 0 ? (
              <div className="afs-empty">No records for this month.</div>
            ) : (
              <table className="afs-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Status</th>
                    <th>Hours</th>
                    <th>Overtime</th>
                    <th>Flags</th>
                  </tr>
                </thead>
                <tbody>
                  {data.daily.map((d) => (
                    <tr key={d.date}>
                      <td data-label="Date">{new Date(d.date).toLocaleDateString("en-IN")}</td>
                      <td data-label="Status">
                        <span className={`att-status-pill att-status-pill-${d.status.toLowerCase()}`}>{d.status.replace("_", " ")}</span>
                      </td>
                      <td data-label="Hours">{d.hours.toFixed(2)}</td>
                      <td data-label="Overtime">{d.overtimeHours > 0 ? d.overtimeHours.toFixed(2) : "—"}</td>
                      <td data-label="Flags">
                        {d.isLate && <span className="att-flag">LATE</span>}
                        {d.isEarlyDeparture && <span className="att-flag">EARLY</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </div>
  );
}
