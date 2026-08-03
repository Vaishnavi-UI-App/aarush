"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { getLocation, resizePhotoToDataUrl } from "@/lib/capture";

interface Record {
  id: string;
  date: string;
  checkInAt: string | null;
  checkOutAt: string | null;
  hours: number | null;
}

export default function AttendanceCheckInOut({ records, today }: { records: Record[]; today: Record | undefined }) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pendingAction, setPendingAction] = useState<"check-in" | "check-out" | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function startAction(action: "check-in" | "check-out") {
    setError(null);
    setPendingAction(action);
    fileInputRef.current?.click();
  }

  async function onPhotoSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !pendingAction) return;

    setBusy(true);
    setError(null);
    try {
      const [{ lat, lng }, photo] = await Promise.all([getLocation(), resizePhotoToDataUrl(file)]);
      const res = await fetch(`/api/attendance/${pendingAction}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lat, lng, photo }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Failed to ${pendingAction === "check-in" ? "check in" : "check out"}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
      setPendingAction(null);
    }
  }

  const canCheckIn = !today?.checkInAt;
  const canCheckOut = !!today?.checkInAt && !today.checkOutAt;

  return (
    <div>
      <div className="afs-card" style={{ marginBottom: 20, padding: 20 }}>
        <input ref={fileInputRef} type="file" accept="image/*" capture="user" style={{ display: "none" }} onChange={onPhotoSelected} />
        <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          <button
            type="button"
            disabled={busy || !canCheckIn}
            onClick={() => startAction("check-in")}
            className="afs-btn afs-btn-primary"
          >
            {today?.checkInAt ? `Checked in at ${new Date(today.checkInAt).toLocaleTimeString("en-IN")}` : "Check In"}
          </button>
          <button
            type="button"
            disabled={busy || !canCheckOut}
            onClick={() => startAction("check-out")}
            className="afs-btn afs-btn-maroon"
          >
            {today?.checkOutAt ? `Checked out at ${new Date(today.checkOutAt).toLocaleTimeString("en-IN")}` : "Check Out"}
          </button>
          {busy && <span style={{ fontSize: 13, color: "#6b7280" }}>Getting your location and photo…</span>}
        </div>
        {error && <div style={{ color: "#b91c1c", fontSize: 13, marginTop: 10 }}>{error}</div>}
        <p style={{ fontSize: 12, color: "#6b7280", marginTop: 10 }}>
          Each punch captures your device location and a photo -- your browser will ask permission for both.
        </p>
      </div>

      <div className="afs-card">
        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>Your recent attendance</div>
        {records.length === 0 ? (
          <div className="afs-empty">No attendance recorded yet.</div>
        ) : (
          <table className="afs-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Check in</th>
                <th>Check out</th>
                <th>Hours</th>
              </tr>
            </thead>
            <tbody>
              {records.map((r) => (
                <tr key={r.id}>
                  <td>{new Date(r.date).toLocaleDateString("en-IN")}</td>
                  <td>{r.checkInAt ? new Date(r.checkInAt).toLocaleTimeString("en-IN") : "—"}</td>
                  <td>{r.checkOutAt ? new Date(r.checkOutAt).toLocaleTimeString("en-IN") : "—"}</td>
                  <td>{r.hours != null ? r.hours.toFixed(2) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
