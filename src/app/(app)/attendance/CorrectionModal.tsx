"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export interface CorrectableRecord {
  id: string;
  userName: string;
  date: string;
  checkInAt: string | null;
  checkOutAt: string | null;
  status: string;
}

const STATUS_OPTIONS = ["PRESENT", "ABSENT", "HALF_DAY", "LEAVE", "HOLIDAY"];

function toDatetimeLocal(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const tzOffsetMs = d.getTimezoneOffset() * 60_000;
  return new Date(d.getTime() - tzOffsetMs).toISOString().slice(0, 16);
}

export default function CorrectionModal({ record, onClose }: { record: CorrectableRecord; onClose: () => void }) {
  const router = useRouter();
  const [checkInAt, setCheckInAt] = useState(toDatetimeLocal(record.checkInAt));
  const [checkOutAt, setCheckOutAt] = useState(toDatetimeLocal(record.checkOutAt));
  const [status, setStatus] = useState(record.status);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/attendance/admin/correct/${record.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          checkInAt: checkInAt ? new Date(checkInAt).toISOString() : null,
          checkOutAt: checkOutAt ? new Date(checkOutAt).toISOString() : null,
          status,
          reason,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save correction");
      router.refresh();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save correction");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="afs-modal-backdrop" onClick={onClose}>
      <div className="afs-modal" onClick={(e) => e.stopPropagation()}>
        <h2>Correct Attendance</h2>
        <p>
          {record.userName} · {new Date(record.date).toLocaleDateString("en-IN")}
        </p>
        <form onSubmit={onSubmit}>
          <div className="afs-form-field" style={{ marginBottom: 12 }}>
            <label>Check-in time</label>
            <input type="datetime-local" value={checkInAt} onChange={(e) => setCheckInAt(e.target.value)} />
          </div>
          <div className="afs-form-field" style={{ marginBottom: 12 }}>
            <label>Check-out time</label>
            <input type="datetime-local" value={checkOutAt} onChange={(e) => setCheckOutAt(e.target.value)} />
          </div>
          <div className="afs-form-field" style={{ marginBottom: 12 }}>
            <label>Status</label>
            <select value={status} onChange={(e) => setStatus(e.target.value)}>
              {STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {s.replace("_", " ")}
                </option>
              ))}
            </select>
          </div>
          <div className="afs-form-field" style={{ marginBottom: 16 }}>
            <label>Reason *</label>
            <textarea required rows={3} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Why is this being corrected?" />
          </div>

          {error && <div style={{ color: "#b91c1c", fontSize: 13, marginBottom: 12 }}>{error}</div>}

          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
            <button type="button" onClick={onClose} disabled={saving} className="afs-btn" style={{ background: "#e5e7eb", color: "#333" }}>
              Cancel
            </button>
            <button type="submit" disabled={saving || !reason.trim()} className="afs-btn afs-btn-primary">
              {saving ? "Saving…" : "Save Correction"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
