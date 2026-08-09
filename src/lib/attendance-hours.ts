/** Shared by AttendanceCheckInOut and the dashboard's live "worked today" card --
 * both need the same running elapsed-hours math and hh:mm:ss display. */

interface PunchLike {
  kind: "CHECK_IN" | "CHECK_OUT";
  at: string;
}

interface BreakLike {
  startAt: string;
  endAt: string | null;
}

export function computeElapsedHours(punches: PunchLike[], breaks: BreakLike[], now: number): number {
  const sorted = [...punches].sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());
  let workMs = 0;
  let openStart: number | null = null;
  for (const p of sorted) {
    const t = new Date(p.at).getTime();
    if (p.kind === "CHECK_IN") {
      if (openStart === null) openStart = t;
    } else if (openStart !== null) {
      workMs += t - openStart;
      openStart = null;
    }
  }
  if (openStart !== null) workMs += Math.max(0, now - openStart);
  const breakMs = breaks.reduce((sum, b) => sum + Math.max(0, (b.endAt ? new Date(b.endAt).getTime() : now) - new Date(b.startAt).getTime()), 0);
  return Math.max(0, (workMs - breakMs) / 3_600_000);
}

/** hh:mm:ss ticking display -- a minute-only granularity only visibly changes once a
 * minute, which reads as frozen even though the underlying value is recomputed every
 * second. */
export function formatHMS(h: number): string {
  const totalSeconds = Math.floor(h * 3600);
  const hrs = Math.floor(totalSeconds / 3600);
  const mins = Math.floor((totalSeconds % 3600) / 60);
  const secs = totalSeconds % 60;
  return `${hrs.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
}
