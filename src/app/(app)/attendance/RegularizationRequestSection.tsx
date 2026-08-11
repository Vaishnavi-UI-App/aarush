"use client";

import { useEffect, useState } from "react";

interface RegularizationDTO {
  id: string;
  date: string;
  requestedCheckInAt: string | null;
  requestedCheckOutAt: string | null;
  reason: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  reviewNote: string | null;
  reviewedBy: { name: string | null; email: string } | null;
  reviewedAt: string | null;
  createdAt: string;
}

const MAX_PER_MONTH = 5;

function statusBadgeClass(status: string) {
  if (status === "APPROVED") return "att-status-pill att-status-pill-present";
  if (status === "REJECTED") return "att-status-pill att-status-pill-absent";
  return "att-status-pill att-status-pill-half_day";
}

function toDatetimeLocal(date: string, hhmm: string): string {
  return `${date}T${hhmm}`;
}

export default function RegularizationRequestSection() {
  const [requests, setRequests] = useState<RegularizationDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  const [date, setDate] = useState("");
  const [checkInTime, setCheckInTime] = useState("");
  const [checkOutTime, setCheckOutTime] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/attendance/regularize?mine=1");
      const data = await res.json();
      setRequests(Array.isArray(data) ? data : []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const thisMonthKey = new Date().toISOString().slice(0, 7);
  const usedThisMonth = requests.filter((r) => r.date.slice(0, 7) === thisMonthKey).length;

  function resetForm() {
    setDate("");
    setCheckInTime("");
    setCheckOutTime("");
    setReason("");
    setError(null);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!date) {
      setError("Pick the date you missed a punch for");
      return;
    }
    if (!checkInTime && !checkOutTime) {
      setError("Enter at least a check-in or check-out time");
      return;
    }
    if (!reason.trim()) {
      setError("A reason is required");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/attendance/regularize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date,
          checkInAt: checkInTime ? new Date(toDatetimeLocal(date, checkInTime)).toISOString() : undefined,
          checkOutAt: checkOutTime ? new Date(toDatetimeLocal(date, checkOutTime)).toISOString() : undefined,
          reason: reason.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to submit request");
      resetForm();
      setShowForm(false);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to submit request");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="afs-card" style={{ marginTop: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600 }}>Attendance Regularization</div>
          <div style={{ fontSize: 12, color: "#667" }}>
            Missed a check-in/out? Request it be corrected. {usedThisMonth}/{MAX_PER_MONTH} used this month.
          </div>
        </div>
        <button
          type="button"
          onClick={() => setShowForm((v) => !v)}
          disabled={usedThisMonth >= MAX_PER_MONTH && !showForm}
          className="afs-btn afs-btn-gold"
          style={{ fontSize: 13, padding: "6px 12px" }}
        >
          {showForm ? "Cancel" : "+ Request Regularization"}
        </button>
      </div>

      {showForm && (
        <form onSubmit={submit} className="afs-card" style={{ background: "#f8f9fd", marginBottom: 16 }}>
          <div className="afs-form-row">
            <div className="afs-form-field">
              <label>Date *</label>
              <input type="date" required value={date} max={new Date().toISOString().slice(0, 10)} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div className="afs-form-field">
              <label>Check-in time</label>
              <input type="time" value={checkInTime} onChange={(e) => setCheckInTime(e.target.value)} />
            </div>
            <div className="afs-form-field">
              <label>Check-out time</label>
              <input type="time" value={checkOutTime} onChange={(e) => setCheckOutTime(e.target.value)} />
            </div>
          </div>
          <div className="afs-form-field" style={{ marginBottom: 12 }}>
            <label>Reason *</label>
            <textarea required rows={2} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. forgot to check out before leaving site" />
          </div>
          {error && <div style={{ color: "#b91c1c", fontSize: 13, marginBottom: 10 }}>{error}</div>}
          <button type="submit" disabled={saving} className="afs-btn afs-btn-primary" style={{ fontSize: 13 }}>
            {saving ? "Submitting…" : "Submit Request"}
          </button>
        </form>
      )}

      {loading ? (
        <div className="afs-empty">Loading…</div>
      ) : requests.length === 0 ? (
        <div className="afs-empty">No regularization requests yet.</div>
      ) : (
        <table className="afs-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Requested check-in</th>
              <th>Requested check-out</th>
              <th>Reason</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {requests.map((r) => (
              <tr key={r.id}>
                <td data-label="Date">{new Date(r.date).toLocaleDateString("en-IN")}</td>
                <td data-label="Requested check-in">{r.requestedCheckInAt ? new Date(r.requestedCheckInAt).toLocaleTimeString("en-IN") : "—"}</td>
                <td data-label="Requested check-out">{r.requestedCheckOutAt ? new Date(r.requestedCheckOutAt).toLocaleTimeString("en-IN") : "—"}</td>
                <td data-label="Reason">{r.reason}</td>
                <td data-label="Status">
                  <span className={statusBadgeClass(r.status)}>{r.status}</span>
                  {r.reviewNote && <div style={{ fontSize: 11, color: "#667", marginTop: 2 }}>{r.reviewNote}</div>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
