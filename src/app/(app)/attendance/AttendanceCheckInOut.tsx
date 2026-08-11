"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getLocation } from "@/lib/capture";
import { computeElapsedHours, formatHMS } from "@/lib/attendance-hours";
import { CalendarCheckIcon, CameraIcon, AlertTriangleIcon } from "@/components/icons";
import LiveCameraCapture from "./LiveCameraCapture";
import RegularizationRequestSection from "./RegularizationRequestSection";

interface PunchDTO {
  id: string;
  kind: "CHECK_IN" | "CHECK_OUT";
  at: string;
  withinGeofence: boolean | null;
  distanceMeters: number | null;
  photoData: string;
}

interface BreakDTO {
  id: string;
  startAt: string;
  endAt: string | null;
}

export interface TodayDTO {
  id: string;
  status: string;
  isLate: boolean;
  siteId: string | null;
  punches: PunchDTO[];
  breaks: BreakDTO[];
}

export interface HistoryRecordDTO {
  id: string;
  date: string;
  status: string;
  computedWorkHours: number | null;
  overtimeHours: number | null;
  isLate: boolean;
  isAutoClosed: boolean;
  checkInAt: string | null;
  checkOutAt: string | null;
}

interface SiteOption {
  id: string;
  name: string;
}

function statusPillClass(status: string) {
  return `att-status-pill att-status-pill-${status.toLowerCase()}`;
}

type PendingAction = "check-in" | "check-out" | null;

export default function AttendanceCheckInOut({
  today,
  records,
  sites,
}: {
  today: TodayDTO | undefined;
  records: HistoryRecordDTO[];
  sites: SiteOption[];
}) {
  const router = useRouter();
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const [showCamera, setShowCamera] = useState(false);
  const [siteId, setSiteId] = useState(today?.siteId ?? "");
  const [busy, setBusy] = useState(false);
  const [breakBusy, setBreakBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [geofenceIssue, setGeofenceIssue] = useState<{ message: string; lat: number; lng: number; photo: string; action: PendingAction } | null>(null);
  const [reason, setReason] = useState("");
  const [now, setNow] = useState(() => Date.now());
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);

  const punches = today?.punches ?? [];
  const breaks = today?.breaks ?? [];
  const lastPunch = punches[punches.length - 1];
  const checkedIn = lastPunch?.kind === "CHECK_IN";
  const onBreak = breaks.some((b) => !b.endAt);

  useEffect(() => {
    if (!checkedIn) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [checkedIn]);

  const elapsedHours = computeElapsedHours(punches, breaks, now);

  function startAction(action: "check-in" | "check-out") {
    setError(null);
    setGeofenceIssue(null);
    setPendingAction(action);
    setShowCamera(true);
  }

  async function submitPunch(action: "check-in" | "check-out", lat: number, lng: number, photo: string, outsideGeofenceReason?: string) {
    const res = await fetch(`/api/attendance/${action}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lat, lng, photo, siteId: siteId || undefined, outsideGeofenceReason }),
    });
    const data = await res.json();
    if (!res.ok) {
      if (data.code === "OUTSIDE_GEOFENCE") {
        setGeofenceIssue({ message: data.error, lat, lng, photo, action });
        return;
      }
      throw new Error(data.error || `Failed to ${action === "check-in" ? "check in" : "check out"}`);
    }
    setGeofenceIssue(null);
    setReason("");
    router.refresh();
  }

  async function onCameraCapture(photo: string) {
    setShowCamera(false);
    if (!pendingAction) return;

    setBusy(true);
    setError(null);
    try {
      const { lat, lng } = await getLocation();
      await submitPunch(pendingAction, lat, lng, photo);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
      setPendingAction(null);
    }
  }

  function onCameraCancel() {
    setShowCamera(false);
    setPendingAction(null);
  }

  async function confirmOutsideGeofence() {
    if (!geofenceIssue || !geofenceIssue.action || !reason.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await submitPunch(geofenceIssue.action, geofenceIssue.lat, geofenceIssue.lng, geofenceIssue.photo, reason.trim());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  async function toggleBreak() {
    setBreakBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/attendance/break/${onBreak ? "end" : "start"}`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update break");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBreakBusy(false);
    }
  }

  const cardClass = onBreak ? "att-status-card on-break" : checkedIn ? "att-status-card checked-in" : "att-status-card";
  const statusText = onBreak ? "On a break" : checkedIn ? "Checked in" : "Not checked in";

  interface TimelineItem {
    key: string;
    kind: "CHECK_IN" | "CHECK_OUT" | "BREAK_START" | "BREAK_END";
    at: string;
    withinGeofence: boolean | null;
    photoData: string | null;
  }

  const timelineItems: TimelineItem[] = [
    ...punches.map((p): TimelineItem => ({ key: `p-${p.id}`, kind: p.kind, at: p.at, withinGeofence: p.withinGeofence, photoData: p.photoData })),
    ...breaks.flatMap((b): TimelineItem[] => {
      const items: TimelineItem[] = [{ key: `bs-${b.id}`, kind: "BREAK_START", at: b.startAt, withinGeofence: null, photoData: null }];
      if (b.endAt) items.push({ key: `be-${b.id}`, kind: "BREAK_END", at: b.endAt, withinGeofence: null, photoData: null });
      return items;
    }),
  ].sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());

  return (
    <div>
      {showCamera && <LiveCameraCapture onCapture={onCameraCapture} onCancel={onCameraCancel} />}

      <div className={cardClass}>
        <div className="att-status-row">
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div className="att-icon-box att-icon-box-gray">
              <CalendarCheckIcon />
            </div>
            <div>
              <div className="att-status-text">{statusText}</div>
              <div className="att-status-label" style={{ marginBottom: 0 }}>
                Today&apos;s status
              </div>
            </div>
          </div>
          {checkedIn && (
            <div>
              <div className="att-timer-label">Worked today</div>
              <div className="att-timer">{formatHMS(elapsedHours)}</div>
            </div>
          )}
        </div>

        {!checkedIn && sites.length > 0 && (
          <div className="att-site-row afs-form-field">
            <label>Site (optional)</label>
            <select value={siteId} onChange={(e) => setSiteId(e.target.value)}>
              <option value="">No specific site</option>
              {sites.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="att-actions" style={{ flexDirection: "column", alignItems: "stretch" }}>
          {!checkedIn ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => startAction("check-in")}
              className="afs-btn afs-btn-primary"
              style={{ justifyContent: "center", padding: "13px", fontSize: 14.5 }}
            >
              <CameraIcon /> {busy && pendingAction === "check-in" ? "Checking in…" : "Check In with Photo"}
            </button>
          ) : (
            <>
              <button
                type="button"
                disabled={busy}
                onClick={() => startAction("check-out")}
                className="afs-btn afs-btn-maroon"
                style={{ justifyContent: "center", padding: "13px", fontSize: 14.5 }}
              >
                <CameraIcon /> {busy && pendingAction === "check-out" ? "Checking out…" : "Check Out with Photo"}
              </button>
              <button
                type="button"
                disabled={breakBusy}
                onClick={toggleBreak}
                className="afs-btn"
                style={{ background: "#e5e7eb", color: "#333", justifyContent: "center", padding: "13px", fontSize: 14.5 }}
              >
                {breakBusy ? "Updating…" : onBreak ? "End Break" : "Start Break"}
              </button>
            </>
          )}
        </div>

        {geofenceIssue && (
          <div className="att-reason-box">
            <p>{geofenceIssue.message}</p>
            <div className="afs-form-field" style={{ marginBottom: 8 }}>
              <label>Reason for checking in outside the geofence</label>
              <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. client site visit, delivery run" />
            </div>
            <button type="button" disabled={busy || !reason.trim()} onClick={confirmOutsideGeofence} className="afs-btn afs-btn-primary" style={{ padding: "6px 14px" }}>
              {busy ? "Submitting…" : `${geofenceIssue.action === "check-in" ? "Check in" : "Check out"} anyway`}
            </button>
          </div>
        )}

        {error && <div style={{ color: "#b91c1c", fontSize: 13, marginTop: 10 }}>{error}</div>}

        {(punches.length > 0 || breaks.length > 0) && (
          <ul className="att-timeline" style={{ marginTop: 16 }}>
            {timelineItems.map((item) => (
              <li key={item.key} className="att-timeline-item">
                <span className={`att-dot ${item.kind === "CHECK_IN" ? "att-dot-in" : item.kind === "CHECK_OUT" ? "att-dot-out" : "att-dot-break"}`} />
                <span style={{ minWidth: 130 }}>
                  {item.kind === "CHECK_IN" ? "Checked in" : item.kind === "CHECK_OUT" ? "Checked out" : item.kind === "BREAK_END" ? "Break ended" : "Break started"}
                </span>
                <span style={{ color: "#667" }}>{new Date(item.at).toLocaleTimeString("en-IN")}</span>
                {item.withinGeofence === false && <span className="att-geo-flag">outside geofence</span>}
                {item.photoData && (
                  <img src={item.photoData} alt="" className="att-photo-thumb" style={{ marginLeft: "auto" }} onClick={() => setPhotoPreview(item.photoData)} />
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {!checkedIn && (
        <div className="att-notice-banner">
          <AlertTriangleIcon />
          <span>Location is captured automatically on check-in and check-out. Please allow location access when prompted.</span>
        </div>
      )}

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
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {records.map((r) => (
                <tr key={r.id}>
                  <td data-label="Date">{new Date(r.date).toLocaleDateString("en-IN")}</td>
                  <td data-label="Check in">{r.checkInAt ? new Date(r.checkInAt).toLocaleTimeString("en-IN") : "—"}</td>
                  <td data-label="Check out">{r.checkOutAt ? new Date(r.checkOutAt).toLocaleTimeString("en-IN") : "—"}</td>
                  <td data-label="Hours">
                    {r.computedWorkHours != null ? r.computedWorkHours.toFixed(2) : "—"}
                    {r.overtimeHours != null && r.overtimeHours > 0 && <span className="att-flag">+{r.overtimeHours.toFixed(1)} OT</span>}
                  </td>
                  <td data-label="Status">
                    <span className={statusPillClass(r.status)}>{r.status.replace("_", " ")}</span>
                    {r.isLate && <span className="att-flag">LATE</span>}
                    {r.isAutoClosed && <span className="att-flag">AUTO-CLOSED</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <RegularizationRequestSection />

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
