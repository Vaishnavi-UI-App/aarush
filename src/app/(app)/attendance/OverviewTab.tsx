"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { PeopleIcon, CheckCircleIcon, XCircleIcon } from "@/components/icons";
import type { AttendancePoint } from "./AttendanceLocationsMap";

const AttendanceLocationsMap = dynamic(() => import("./AttendanceLocationsMap"), { ssr: false, loading: () => <div className="afs-empty">Loading map…</div> });

interface StaffUser {
  id: string;
  name: string | null;
  email: string;
}

interface Record {
  id: string;
  checkInAt: string | null;
  checkInLat: string | null;
  checkInLng: string | null;
  checkInPhotoData: string | null;
  checkOutAt: string | null;
  checkOutLat: string | null;
  checkOutLng: string | null;
  checkOutPhotoData: string | null;
  hours: number | null;
  user: { id: string; name: string | null; email: string; roleRef: { name: string } | null };
}

function todayIso(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

function mapsLink(lat: string | null, lng: string | null) {
  if (!lat || !lng) return null;
  return `https://www.google.com/maps?q=${lat},${lng}`;
}

export default function OverviewTab({ staff }: { staff: StaffUser[] }) {
  const [date, setDate] = useState(todayIso());
  const [records, setRecords] = useState<Record[]>([]);
  const [loading, setLoading] = useState(false);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/attendance?from=${date}&to=${date}`)
      .then((res) => res.json())
      .then((data) => setRecords(Array.isArray(data) ? data : []))
      .finally(() => setLoading(false));
  }, [date]);

  const present = records.length;
  const completed = records.filter((r) => r.checkOutAt).length;
  const absent = Math.max(0, staff.length - present);

  const points: AttendancePoint[] = useMemo(() => {
    const out: AttendancePoint[] = [];
    for (const r of records) {
      const name = r.user.name || r.user.email;
      if (r.checkInLat && r.checkInLng) {
        out.push({ key: `${r.id}-in`, employeeName: name, kind: "CHECK_IN", at: r.checkInAt!, lat: Number(r.checkInLat), lng: Number(r.checkInLng) });
      }
      if (r.checkOutLat && r.checkOutLng) {
        out.push({ key: `${r.id}-out`, employeeName: name, kind: "CHECK_OUT", at: r.checkOutAt!, lat: Number(r.checkOutLat), lng: Number(r.checkOutLng) });
      }
    }
    return out;
  }, [records]);

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 16 }}>
        <div className="afs-form-field" style={{ maxWidth: 200 }}>
          <label>Date</label>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
      </div>

      <div className="att-stat-grid" style={{ marginBottom: 20 }}>
        <div className="att-stat-card">
          <div className="att-icon-box att-icon-box-blue">
            <PeopleIcon />
          </div>
          <div className="att-stat-value">{present}</div>
          <div className="att-stat-label" style={{ marginBottom: 0 }}>
            Present
          </div>
        </div>
        <div className="att-stat-card">
          <div className="att-icon-box att-icon-box-green">
            <CheckCircleIcon />
          </div>
          <div className="att-stat-value">{completed}</div>
          <div className="att-stat-label" style={{ marginBottom: 0 }}>
            Completed
          </div>
        </div>
        <div className="att-stat-card">
          <div className="att-icon-box att-icon-box-rose">
            <XCircleIcon />
          </div>
          <div className="att-stat-value">{absent}</div>
          <div className="att-stat-label" style={{ marginBottom: 0 }}>
            Absent
          </div>
        </div>
      </div>

      {points.length > 0 && (
        <div className="afs-card" style={{ marginBottom: 20, padding: 0, overflow: "hidden" }}>
          <AttendanceLocationsMap points={points} />
        </div>
      )}

      <div className="afs-card">
        {loading ? (
          <div className="afs-empty">Loading…</div>
        ) : records.length === 0 ? (
          <div className="afs-empty">No attendance records for {date}</div>
        ) : (
          <table className="afs-table">
            <thead>
              <tr>
                <th>Employee</th>
                <th>Role</th>
                <th>Check in</th>
                <th>Check out</th>
                <th>Hours</th>
                <th>Check-in location</th>
                <th>Check-out location</th>
                <th>Photos</th>
              </tr>
            </thead>
            <tbody>
              {records.map((r) => (
                <tr key={r.id}>
                  <td data-label="Employee">{r.user.name || r.user.email}</td>
                  <td data-label="Role">{r.user.roleRef?.name ?? "—"}</td>
                  <td data-label="Check in">{r.checkInAt ? new Date(r.checkInAt).toLocaleTimeString("en-IN") : "—"}</td>
                  <td data-label="Check out">{r.checkOutAt ? new Date(r.checkOutAt).toLocaleTimeString("en-IN") : "—"}</td>
                  <td data-label="Hours">{r.hours != null ? r.hours.toFixed(2) : "—"}</td>
                  <td data-label="Check-in location">
                    {mapsLink(r.checkInLat, r.checkInLng) ? (
                      <a href={mapsLink(r.checkInLat, r.checkInLng)!} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12 }}>
                        View on map
                      </a>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td data-label="Check-out location">
                    {mapsLink(r.checkOutLat, r.checkOutLng) ? (
                      <a href={mapsLink(r.checkOutLat, r.checkOutLng)!} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12 }}>
                        View on map
                      </a>
                    ) : (
                      "—"
                    )}
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
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {photoPreview && (
        <div
          onClick={() => setPhotoPreview(null)}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, cursor: "zoom-out" }}
        >
          <img src={photoPreview} alt="attendance photo" style={{ maxWidth: "90vw", maxHeight: "90vh", borderRadius: 8 }} />
        </div>
      )}
    </div>
  );
}
