import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { round2 } from "@/lib/gst-invoice";
import { checkGeofence } from "@/lib/geo";

export class AttendanceError extends Error {
  status: number;
  code?: string;
  constructor(message: string, status = 400, code?: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

type Decimalish = number | string | Prisma.Decimal;

/** A @db.Date column has no timezone, so the value must be constructed at UTC midnight
 * of the server's *local* calendar day -- setHours(0,0,0,0) followed by serialization
 * truncates to the UTC calendar day instead, which is off by one in any timezone ahead
 * of UTC (e.g. IST, UTC+5:30) for hours after local midnight but before UTC midnight. */
export function attendanceDateBucket(when: Date = new Date()): Date {
  return new Date(Date.UTC(when.getFullYear(), when.getMonth(), when.getDate()));
}

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

/** ShiftConfig start/end times are plain "HH:MM" wall-clock strings, always meant in IST
 * (this app has one country of users) -- this converts one to the real UTC instant it
 * refers to on a given calendar day, independent of the server process's own timezone. */
export function istTimeToUtcInstant(dateBucket: Date, hhmm: string): Date {
  const [h, m] = hhmm.split(":").map(Number);
  const y = dateBucket.getUTCFullYear();
  const mo = dateBucket.getUTCMonth();
  const d = dateBucket.getUTCDate();
  return new Date(Date.UTC(y, mo, d, h, m) - IST_OFFSET_MS);
}

export interface ShiftLike {
  id?: string;
  startTime: string;
  endTime: string;
  gracePeriodMins: number;
  halfDayThresholdHrs: Decimalish;
  fullDayThresholdHrs: Decimalish;
  overtimeAfterHrs: Decimalish;
}

const DEFAULT_SHIFT_FIELDS = {
  name: "Default Shift",
  startTime: "09:30",
  endTime: "18:30",
  gracePeriodMins: 10,
  halfDayThresholdHrs: 4,
  fullDayThresholdHrs: 8,
  overtimeAfterHrs: 9,
};

/** Role-specific shift config wins; falls back to the tenant's default (roleId: null).
 * If neither exists yet (brand new tenant, seed never ran), auto-provisions the tenant
 * default so callers always get a real, persisted row to point shiftConfigId at. */
export async function resolveShiftConfig(tenantId: string, roleId: string | null | undefined) {
  if (roleId) {
    const roleSpecific = await prisma.shiftConfig.findUnique({ where: { tenantId_roleId: { tenantId, roleId } } });
    if (roleSpecific) return roleSpecific;
  }
  // roleId is part of the compound unique index, but Prisma's findUnique/upsert reject a
  // literal null there (a unique index with NULL isn't a normal equality match at the SQL
  // level) -- findFirst has no such restriction and null is an ordinary filter value there.
  const fallback = await prisma.shiftConfig.findFirst({ where: { tenantId, roleId: null } });
  if (fallback) return fallback;

  return prisma.shiftConfig.create({ data: { tenantId, roleId: null, ...DEFAULT_SHIFT_FIELDS } });
}

export interface PunchLike {
  kind: "CHECK_IN" | "CHECK_OUT";
  at: Date;
  withinGeofence: boolean | null;
}

export interface BreakLike {
  startAt: Date;
  endAt: Date | null;
}

export type AttendanceStatusValue = "PRESENT" | "ABSENT" | "HALF_DAY" | "LEAVE" | "HOLIDAY";

export interface DerivedAttendance {
  computedWorkHours: number;
  breakMinutes: number;
  overtimeHours: number;
  isLate: boolean;
  isEarlyDeparture: boolean;
  isOpen: boolean;
  status: AttendanceStatusValue;
  checkInWithinGeofence: boolean | null;
  checkOutWithinGeofence: boolean | null;
  firstCheckIn: PunchLike | null;
  lastCheckOut: PunchLike | null;
}

/** Pairs up a day's check-in/check-out punches (oldest first) into worked sessions,
 * subtracts break time, and derives the late/early/status flags against the shift's
 * rules. `now` is the instant to treat an unclosed session as running until -- pass the
 * real current time for "today", or a synthetic end-of-day cutoff when auto-closing a
 * past day that was never checked out. */
export function deriveAttendance(dateBucket: Date, punches: PunchLike[], breaks: BreakLike[], shift: ShiftLike, now: Date): DerivedAttendance {
  const sorted = [...punches].sort((a, b) => a.at.getTime() - b.at.getTime());

  let workMs = 0;
  let openStart: Date | null = null;
  let isOpen = false;
  const firstCheckIn = sorted.find((p) => p.kind === "CHECK_IN") ?? null;
  const checkOuts = sorted.filter((p) => p.kind === "CHECK_OUT");
  const lastCheckOut = checkOuts[checkOuts.length - 1] ?? null;

  for (const p of sorted) {
    if (p.kind === "CHECK_IN") {
      if (openStart === null) openStart = p.at;
    } else if (openStart !== null) {
      workMs += p.at.getTime() - openStart.getTime();
      openStart = null;
    }
  }
  if (openStart !== null) {
    isOpen = true;
    workMs += Math.max(0, now.getTime() - openStart.getTime());
  }

  const breakMs = breaks.reduce((sum, b) => sum + Math.max(0, (b.endAt ?? now).getTime() - b.startAt.getTime()), 0);
  const computedWorkHours = round2(workMs / 3_600_000);
  const breakMinutes = Math.round(breakMs / 60_000);
  const netHours = Math.max(0, computedWorkHours - breakMinutes / 60);
  const overtimeHours = round2(Math.max(0, netHours - Number(shift.overtimeAfterHrs)));

  const graceMs = shift.gracePeriodMins * 60_000;
  const isLate = firstCheckIn ? firstCheckIn.at.getTime() > istTimeToUtcInstant(dateBucket, shift.startTime).getTime() + graceMs : false;
  const isEarlyDeparture = !isOpen && lastCheckOut ? lastCheckOut.at.getTime() < istTimeToUtcInstant(dateBucket, shift.endTime).getTime() : false;

  const status: AttendanceStatusValue =
    sorted.length === 0 ? "ABSENT" : netHours < Number(shift.halfDayThresholdHrs) ? "HALF_DAY" : "PRESENT";

  return {
    computedWorkHours,
    breakMinutes,
    overtimeHours,
    isLate,
    isEarlyDeparture,
    isOpen,
    status,
    checkInWithinGeofence: firstCheckIn?.withinGeofence ?? null,
    checkOutWithinGeofence: isOpen ? null : (lastCheckOut?.withinGeofence ?? null),
    firstCheckIn,
    lastCheckOut,
  };
}

/** Recomputes and persists an AttendanceRecord's derived summary fields from its
 * punches/breaks -- called after every check-in, check-out, break event, and manual
 * correction so the summary row never drifts out of sync with the underlying log. */
export async function recomputeRecord(recordId: string, now: Date = new Date()) {
  const rec = await prisma.attendanceRecord.findUniqueOrThrow({
    where: { id: recordId },
    include: {
      punches: { orderBy: { at: "asc" } },
      breaks: { orderBy: { startAt: "asc" } },
      shiftConfig: true,
      user: { select: { roleId: true } },
    },
  });

  const shift = rec.shiftConfig ?? (await resolveShiftConfig(rec.tenantId, rec.user.roleId));
  const derived = deriveAttendance(
    rec.date,
    rec.punches.map((p) => ({ kind: p.kind, at: p.at, withinGeofence: p.withinGeofence })),
    rec.breaks.map((b) => ({ startAt: b.startAt, endAt: b.endAt })),
    shift,
    now
  );

  const checkOuts = rec.punches.filter((p) => p.kind === "CHECK_OUT");
  const lastCheckOut = checkOuts[checkOuts.length - 1] ?? null;
  const firstCheckIn = rec.punches.find((p) => p.kind === "CHECK_IN") ?? null;

  return prisma.attendanceRecord.update({
    where: { id: recordId },
    data: {
      shiftConfigId: shift.id,
      checkInAt: firstCheckIn?.at ?? rec.checkInAt,
      checkInLat: firstCheckIn?.lat ?? rec.checkInLat,
      checkInLng: firstCheckIn?.lng ?? rec.checkInLng,
      checkInPhotoData: firstCheckIn?.photoData ?? rec.checkInPhotoData,
      checkOutAt: lastCheckOut?.at ?? null,
      checkOutLat: lastCheckOut?.lat ?? null,
      checkOutLng: lastCheckOut?.lng ?? null,
      checkOutPhotoData: lastCheckOut?.photoData ?? null,
      status: derived.status,
      computedWorkHours: derived.computedWorkHours,
      breakMinutes: derived.breakMinutes,
      overtimeHours: derived.overtimeHours,
      isLate: derived.isLate,
      isEarlyDeparture: derived.isEarlyDeparture,
      checkInWithinGeofence: derived.checkInWithinGeofence,
      checkOutWithinGeofence: derived.checkOutWithinGeofence,
    },
    include: { punches: { orderBy: { at: "asc" } }, breaks: { orderBy: { startAt: "asc" } }, shiftConfig: true },
  });
}

/** Closes out any of this tenant's (optionally, one user's) past open days -- a
 * check-in with no matching check-out on a date before today. There's no cron runner
 * in this deployment, so this is called lazily wherever attendance is read (today's
 * status, the admin team view, monthly reports) rather than at a fixed midnight tick;
 * it's a no-op once a day has already been closed or auto-closed. Closes at 23:59 IST
 * of that day, using only the real punches already logged -- no photo/location is
 * fabricated for the synthetic close. */
export async function reconcileStaleOpenDays(tenantId: string, userId?: string): Promise<void> {
  const today = attendanceDateBucket();
  const stale = await prisma.attendanceRecord.findMany({
    where: {
      tenantId,
      ...(userId ? { userId } : {}),
      date: { lt: today },
      checkInAt: { not: null },
      checkOutAt: null,
      isAutoClosed: false,
    },
    select: { id: true, date: true },
  });

  for (const rec of stale) {
    const cutoff = istTimeToUtcInstant(rec.date, "23:59");
    const updated = await recomputeRecord(rec.id, cutoff);
    await prisma.attendanceRecord.update({
      where: { id: rec.id },
      data: { isAutoClosed: true, isEarlyDeparture: true, checkOutAt: updated.checkOutAt ?? cutoff },
    });
  }
}

function lockKey(tenantId: string, userId: string, date: Date): string {
  return `attendance:${tenantId}:${userId}:${date.toISOString()}`;
}

export interface PunchInput {
  tenantId: string;
  userId: string;
  kind: "CHECK_IN" | "CHECK_OUT";
  lat: number;
  lng: number;
  photo: string;
  siteId?: string | null;
  outsideGeofenceReason?: string;
}

/** Records one check-in or check-out event and recomputes the day's summary. Enforces:
 * a site's geofence (if configured) unless a reason is given for the override; strict
 * in-order check-in/check-out pairing (no double check-in, no check-out before check-in);
 * and single-writer-per-user-per-day via a Postgres advisory lock, so two devices firing
 * at once can't both create a punch off the same "last punch" read. */
export async function recordPunch(input: PunchInput) {
  const { tenantId, userId, kind, lat, lng, photo, siteId, outsideGeofenceReason } = input;
  const date = attendanceDateBucket();

  const site = siteId ? await prisma.site.findFirst({ where: { id: siteId, tenantId } }) : null;
  if (siteId && !site) throw new AttendanceError("Site not found", 404);

  const geofence = checkGeofence(site, lat, lng);
  if (geofence.withinGeofence === false && !outsideGeofenceReason) {
    throw new AttendanceError(
      `You're ${geofence.distanceMeters}m from ${site!.name} (limit ${site!.geofenceRadiusM}m). Add a reason to check in anyway.`,
      422,
      "OUTSIDE_GEOFENCE"
    );
  }

  const recordId = await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${lockKey(tenantId, userId, date)}))`;

    let record = await tx.attendanceRecord.findUnique({ where: { tenantId_userId_date: { tenantId, userId, date } } });
    if (!record) {
      record = await tx.attendanceRecord.create({ data: { tenantId, userId, date, siteId: siteId ?? undefined } });
    }

    const lastPunch = await tx.attendancePunch.findFirst({ where: { recordId: record.id }, orderBy: { at: "desc" } });
    if (kind === "CHECK_IN" && lastPunch?.kind === "CHECK_IN") {
      throw new AttendanceError("You're already checked in -- check out first", 409);
    }
    if (kind === "CHECK_OUT") {
      if (!lastPunch) throw new AttendanceError("You haven't checked in yet", 409);
      if (lastPunch.kind === "CHECK_OUT") throw new AttendanceError("You're already checked out -- check in again to start a new session", 409);
    }

    await tx.attendancePunch.create({
      data: {
        recordId: record.id,
        kind,
        at: new Date(),
        lat,
        lng,
        photoData: photo,
        withinGeofence: geofence.withinGeofence,
        distanceMeters: geofence.distanceMeters,
      },
    });

    if (siteId || outsideGeofenceReason) {
      await tx.attendanceRecord.update({
        where: { id: record.id },
        data: { siteId: siteId ?? record.siteId, outsideGeofenceReason: outsideGeofenceReason ?? record.outsideGeofenceReason },
      });
    }

    return record.id;
  });

  return recomputeRecord(recordId);
}

export async function startBreak(tenantId: string, userId: string) {
  const date = attendanceDateBucket();
  const recordId = await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${lockKey(tenantId, userId, date)}))`;

    const record = await tx.attendanceRecord.findUnique({ where: { tenantId_userId_date: { tenantId, userId, date } } });
    if (!record) throw new AttendanceError("Check in before starting a break", 409);

    const lastPunch = await tx.attendancePunch.findFirst({ where: { recordId: record.id }, orderBy: { at: "desc" } });
    if (lastPunch?.kind !== "CHECK_IN") throw new AttendanceError("You're not checked in right now", 409);

    const openBreak = await tx.attendanceBreak.findFirst({ where: { recordId: record.id, endAt: null } });
    if (openBreak) throw new AttendanceError("You're already on a break", 409);

    await tx.attendanceBreak.create({ data: { recordId: record.id, startAt: new Date() } });
    return record.id;
  });

  return recomputeRecord(recordId);
}

export async function endBreak(tenantId: string, userId: string) {
  const date = attendanceDateBucket();
  const recordId = await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${lockKey(tenantId, userId, date)}))`;

    const record = await tx.attendanceRecord.findUnique({ where: { tenantId_userId_date: { tenantId, userId, date } } });
    if (!record) throw new AttendanceError("No attendance record for today", 409);

    const openBreak = await tx.attendanceBreak.findFirst({ where: { recordId: record.id, endAt: null } });
    if (!openBreak) throw new AttendanceError("You're not on a break", 409);

    await tx.attendanceBreak.update({ where: { id: openBreak.id }, data: { endAt: new Date() } });
    return record.id;
  });

  return recomputeRecord(recordId);
}
