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
  user: { name: string | null; email: string };
  reviewedBy: { name: string | null; email: string } | null;
  reviewedAt: string | null;
  createdAt: string;
}

function statusBadgeClass(status: string) {
  if (status === "APPROVED") return "att-status-pill att-status-pill-present";
  if (status === "REJECTED") return "att-status-pill att-status-pill-absent";
  return "att-status-pill att-status-pill-half_day";
}

export default function RegularizationQueueTab() {
  const [requests, setRequests] = useState<RegularizationDTO[]>([]);
  const [statusFilter, setStatusFilter] = useState<"PENDING" | "APPROVED" | "REJECTED" | "">("PENDING");
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [noteDraft, setNoteDraft] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.set("status", statusFilter);
      const res = await fetch(`/api/attendance/regularize?${params.toString()}`);
      const data = await res.json();
      setRequests(Array.isArray(data) ? data : []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter]);

  async function review(id: string, action: "approve" | "reject") {
    setBusyId(id);
    setError(null);
    try {
      const res = await fetch(`/api/attendance/regularize/${id}/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reviewNote: noteDraft[id]?.trim() || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Failed to ${action}`);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : `Failed to ${action}`);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div>
      <div className="afs-card" style={{ marginBottom: 20, padding: 16 }}>
        <div className="afs-form-field" style={{ maxWidth: 220 }}>
          <label>Status</label>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}>
            <option value="PENDING">Pending</option>
            <option value="APPROVED">Approved</option>
            <option value="REJECTED">Rejected</option>
            <option value="">All</option>
          </select>
        </div>
      </div>

      {error && <div style={{ color: "#b91c1c", fontSize: 13, marginBottom: 12 }}>{error}</div>}

      <div className="afs-card">
        {loading ? (
          <div className="afs-empty">Loading…</div>
        ) : requests.length === 0 ? (
          <div className="afs-empty">No regularization requests here.</div>
        ) : (
          <table className="afs-table">
            <thead>
              <tr>
                <th>Staff</th>
                <th>Date</th>
                <th>Requested check-in</th>
                <th>Requested check-out</th>
                <th>Reason</th>
                <th>Status</th>
                <th>Review</th>
              </tr>
            </thead>
            <tbody>
              {requests.map((r) => (
                <tr key={r.id}>
                  <td data-label="Staff">{r.user.name || r.user.email}</td>
                  <td data-label="Date">{new Date(r.date).toLocaleDateString("en-IN")}</td>
                  <td data-label="Requested check-in">{r.requestedCheckInAt ? new Date(r.requestedCheckInAt).toLocaleTimeString("en-IN") : "—"}</td>
                  <td data-label="Requested check-out">{r.requestedCheckOutAt ? new Date(r.requestedCheckOutAt).toLocaleTimeString("en-IN") : "—"}</td>
                  <td data-label="Reason">{r.reason}</td>
                  <td data-label="Status">
                    <span className={statusBadgeClass(r.status)}>{r.status}</span>
                    {r.reviewNote && <div style={{ fontSize: 11, color: "#667", marginTop: 2 }}>{r.reviewNote}</div>}
                  </td>
                  <td data-label="Review">
                    {r.status === "PENDING" ? (
                      <div style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 180 }}>
                        <input
                          placeholder="Note (optional)"
                          value={noteDraft[r.id] ?? ""}
                          onChange={(e) => setNoteDraft((d) => ({ ...d, [r.id]: e.target.value }))}
                          style={{ fontSize: 12, padding: "4px 6px" }}
                        />
                        <div style={{ display: "flex", gap: 6 }}>
                          <button
                            type="button"
                            disabled={busyId === r.id}
                            onClick={() => review(r.id, "approve")}
                            className="afs-btn afs-btn-primary"
                            style={{ padding: "4px 10px", fontSize: 12 }}
                          >
                            Approve
                          </button>
                          <button
                            type="button"
                            disabled={busyId === r.id}
                            onClick={() => review(r.id, "reject")}
                            className="afs-btn afs-btn-maroon"
                            style={{ padding: "4px 10px", fontSize: 12 }}
                          >
                            Reject
                          </button>
                        </div>
                      </div>
                    ) : (
                      <span style={{ color: "#999", fontSize: 12 }}>
                        {r.reviewedBy ? `by ${r.reviewedBy.name || r.reviewedBy.email}` : "—"}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
