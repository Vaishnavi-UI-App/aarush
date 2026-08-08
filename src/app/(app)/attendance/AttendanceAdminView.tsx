"use client";

import { useEffect, useState } from "react";
import OverviewTab from "./OverviewTab";
import TeamTodayGrid from "./TeamTodayGrid";
import MonthlyReport from "./MonthlyReport";
import CorrectionModal, { CorrectableRecord } from "./CorrectionModal";

interface StaffUser {
  id: string;
  name: string | null;
  email: string;
}

interface Record {
  id: string;
  date: string;
  status: string;
  isLate: boolean;
  isAutoClosed: boolean;
  isManualEntry: boolean;
  checkInAt: string | null;
  checkInLat: string | null;
  checkInLng: string | null;
  checkInPhotoData: string | null;
  checkOutAt: string | null;
  checkOutLat: string | null;
  checkOutLng: string | null;
  checkOutPhotoData: string | null;
  hours: number | null;
  overtimeHours: string | null;
  site: { id: string; name: string } | null;
  user: StaffUser;
}

function mapsLink(lat: string | null, lng: string | null) {
  if (!lat || !lng) return null;
  return `https://www.google.com/maps?q=${lat},${lng}`;
}

function HistoryTab({ staff }: { staff: StaffUser[] }) {
  const [userId, setUserId] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [records, setRecords] = useState<Record[]>([]);
  const [loading, setLoading] = useState(false);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [correcting, setCorrecting] = useState<Record | null>(null);

  useEffect(() => {
    const params = new URLSearchParams();
    if (userId) params.set("userId", userId);
    if (from) params.set("from", from);
    if (to) params.set("to", to);

    setLoading(true);
    fetch(`/api/attendance?${params.toString()}`)
      .then((res) => res.json())
      .then((data) => setRecords(Array.isArray(data) ? data : []))
      .finally(() => setLoading(false));
  }, [userId, from, to]);

  const totalHours = records.reduce((sum, r) => sum + (r.hours ?? 0), 0);

  return (
    <div>
      <div className="afs-card" style={{ marginBottom: 20, padding: 16 }}>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
          <div className="afs-form-field" style={{ maxWidth: 220 }}>
            <label>Staff</label>
            <select value={userId} onChange={(e) => setUserId(e.target.value)}>
              <option value="">All staff</option>
              {staff.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name || s.email}
                </option>
              ))}
            </select>
          </div>
          <div className="afs-form-field" style={{ maxWidth: 160 }}>
            <label>From</label>
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div className="afs-form-field" style={{ maxWidth: 160 }}>
            <label>To</label>
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
          <div style={{ fontSize: 13, color: "#374151", paddingBottom: 10 }}>
            {loading ? "Loading…" : `${records.length} record${records.length === 1 ? "" : "s"} · ${totalHours.toFixed(2)} total hrs`}
          </div>
        </div>
      </div>

      <div className="afs-card">
        {records.length === 0 ? (
          <div className="afs-empty">No attendance records for this filter.</div>
        ) : (
          <table className="afs-table">
            <thead>
              <tr>
                <th>Staff</th>
                <th>Date</th>
                <th>Check in</th>
                <th>Check out</th>
                <th>Hours</th>
                <th>Status</th>
                <th>Photos</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {records.map((r) => (
                <tr key={r.id}>
                  <td data-label="Staff">{r.user.name || r.user.email}</td>
                  <td data-label="Date">{new Date(r.date).toLocaleDateString("en-IN")}</td>
                  <td data-label="Check in">
                    {r.checkInAt ? new Date(r.checkInAt).toLocaleTimeString("en-IN") : "—"}
                    {mapsLink(r.checkInLat, r.checkInLng) && (
                      <>
                        {" "}
                        <a href={mapsLink(r.checkInLat, r.checkInLng)!} target="_blank" rel="noopener noreferrer" style={{ fontSize: 11 }}>
                          (map)
                        </a>
                      </>
                    )}
                  </td>
                  <td data-label="Check out">
                    {r.checkOutAt ? new Date(r.checkOutAt).toLocaleTimeString("en-IN") : "—"}
                    {mapsLink(r.checkOutLat, r.checkOutLng) && (
                      <>
                        {" "}
                        <a href={mapsLink(r.checkOutLat, r.checkOutLng)!} target="_blank" rel="noopener noreferrer" style={{ fontSize: 11 }}>
                          (map)
                        </a>
                      </>
                    )}
                  </td>
                  <td data-label="Hours">{r.hours != null ? r.hours.toFixed(2) : "—"}</td>
                  <td data-label="Status">
                    <span className={`att-status-pill att-status-pill-${r.status.toLowerCase()}`}>{r.status.replace("_", " ")}</span>
                    {r.isLate && <span className="att-flag">LATE</span>}
                    {r.isAutoClosed && <span className="att-flag">AUTO</span>}
                    {r.isManualEntry && <span className="att-flag">EDITED</span>}
                  </td>
                  <td data-label="Photos" style={{ display: "flex", gap: 6 }}>
                    {r.checkInPhotoData && (
                      <img
                        src={r.checkInPhotoData}
                        alt="check-in"
                        onClick={() => setPhotoPreview(r.checkInPhotoData)}
                        style={{ width: 32, height: 32, borderRadius: 4, objectFit: "cover", cursor: "pointer" }}
                      />
                    )}
                    {r.checkOutPhotoData && (
                      <img
                        src={r.checkOutPhotoData}
                        alt="check-out"
                        onClick={() => setPhotoPreview(r.checkOutPhotoData)}
                        style={{ width: 32, height: 32, borderRadius: 4, objectFit: "cover", cursor: "pointer" }}
                      />
                    )}
                  </td>
                  <td>
                    <button type="button" onClick={() => setCorrecting(r)} className="afs-btn" style={{ background: "#e5e7eb", color: "#333", padding: "4px 10px", fontSize: 12 }}>
                      Correct
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {photoPreview && (
        <div
          onClick={() => setPhotoPreview(null)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.7)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            cursor: "zoom-out",
          }}
        >
          <img src={photoPreview} alt="attendance photo" style={{ maxWidth: "90vw", maxHeight: "90vh", borderRadius: 8 }} />
        </div>
      )}

      {correcting && (
        <CorrectionModal
          record={
            {
              id: correcting.id,
              userName: correcting.user.name || correcting.user.email,
              date: correcting.date,
              checkInAt: correcting.checkInAt,
              checkOutAt: correcting.checkOutAt,
              status: correcting.status,
            } satisfies CorrectableRecord
          }
          onClose={() => setCorrecting(null)}
        />
      )}
    </div>
  );
}

export default function AttendanceAdminView({ staff }: { staff: StaffUser[] }) {
  const [tab, setTab] = useState<"overview" | "today" | "history" | "reports">("overview");

  return (
    <div>
      <div style={{ display: "flex", gap: 8, marginBottom: 18, flexWrap: "wrap" }}>
        {(["overview", "today", "history", "reports"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={tab === t ? "afs-btn afs-btn-primary" : "afs-btn"}
            style={tab === t ? undefined : { background: "#e5e7eb", color: "#333" }}
          >
            {t === "overview" ? "Overview" : t === "today" ? "Team Today" : t === "history" ? "History" : "Monthly Report"}
          </button>
        ))}
      </div>

      {tab === "overview" && <OverviewTab staff={staff} />}
      {tab === "today" && <TeamTodayGrid />}
      {tab === "history" && <HistoryTab staff={staff} />}
      {tab === "reports" && <MonthlyReport staff={staff} />}
    </div>
  );
}
