"use client";

import { useEffect, useState } from "react";

interface StaffUser {
  id: string;
  name: string | null;
  email: string;
}

interface Record {
  id: string;
  date: string;
  checkInAt: string | null;
  checkInLat: string | null;
  checkInLng: string | null;
  checkInPhotoData: string | null;
  checkOutAt: string | null;
  checkOutLat: string | null;
  checkOutLng: string | null;
  checkOutPhotoData: string | null;
  hours: number | null;
  user: StaffUser;
}

function mapsLink(lat: string | null, lng: string | null) {
  if (!lat || !lng) return null;
  return `https://www.google.com/maps?q=${lat},${lng}`;
}

export default function AttendanceAdminView({ staff }: { staff: StaffUser[] }) {
  const [userId, setUserId] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [records, setRecords] = useState<Record[]>([]);
  const [loading, setLoading] = useState(false);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);

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
                <th>Photos</th>
              </tr>
            </thead>
            <tbody>
              {records.map((r) => (
                <tr key={r.id}>
                  <td>{r.user.name || r.user.email}</td>
                  <td>{new Date(r.date).toLocaleDateString("en-IN")}</td>
                  <td>
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
                  <td>
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
                  <td>{r.hours != null ? r.hours.toFixed(2) : "—"}</td>
                  <td style={{ display: "flex", gap: 6 }}>
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
    </div>
  );
}
