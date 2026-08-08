import { NextRequest, NextResponse } from "next/server";
import { requireSession, SessionError } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/permissions";
import { deriveAttendance, resolveShiftConfig, PunchLike, AttendanceStatusValue } from "@/lib/attendance";

const VALID_STATUSES: AttendanceStatusValue[] = ["PRESENT", "ABSENT", "HALF_DAY", "LEAVE", "HOLIDAY"];

/** Manual correction of a day's check-in/out times or status, with a required reason.
 * Never touches the underlying punch log (that's the real GPS/photo history) -- it
 * corrects the day's summary fields and recomputes hours/late/early from the corrected
 * times, then writes an AttendanceAuditLog row so every correction is traceable. */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  let session;
  try {
    session = requireSession(request);
  } catch (e) {
    if (e instanceof SessionError) return NextResponse.json({ error: e.message }, { status: 401 });
    throw e;
  }
  if (!(await can(session.tenantId, session.roleId, "allAttendance", "edit"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const { checkInAt, checkOutAt, status, reason } = body;

  if (typeof reason !== "string" || !reason.trim()) {
    return NextResponse.json({ error: "A reason is required for every correction" }, { status: 400 });
  }
  if (checkInAt !== undefined && checkInAt !== null && Number.isNaN(Date.parse(checkInAt))) {
    return NextResponse.json({ error: "checkInAt must be a valid date/time" }, { status: 400 });
  }
  if (checkOutAt !== undefined && checkOutAt !== null && Number.isNaN(Date.parse(checkOutAt))) {
    return NextResponse.json({ error: "checkOutAt must be a valid date/time" }, { status: 400 });
  }
  if (status !== undefined && !VALID_STATUSES.includes(status)) {
    return NextResponse.json({ error: `status must be one of ${VALID_STATUSES.join(", ")}` }, { status: 400 });
  }
  if (checkInAt === undefined && checkOutAt === undefined && status === undefined) {
    return NextResponse.json({ error: "Nothing to correct -- provide checkInAt, checkOutAt, and/or status" }, { status: 400 });
  }

  const record = await prisma.attendanceRecord.findFirst({
    where: { id, tenantId: session.tenantId },
    include: { breaks: { orderBy: { startAt: "asc" } }, user: { select: { roleId: true } } },
  });
  if (!record) return NextResponse.json({ error: "Attendance record not found" }, { status: 404 });

  const newCheckInAt = checkInAt === undefined ? record.checkInAt : checkInAt === null ? null : new Date(checkInAt);
  const newCheckOutAt = checkOutAt === undefined ? record.checkOutAt : checkOutAt === null ? null : new Date(checkOutAt);

  const shift = await resolveShiftConfig(session.tenantId, record.user.roleId);
  const syntheticPunches: PunchLike[] = [];
  if (newCheckInAt) syntheticPunches.push({ kind: "CHECK_IN", at: newCheckInAt, withinGeofence: null });
  if (newCheckOutAt) syntheticPunches.push({ kind: "CHECK_OUT", at: newCheckOutAt, withinGeofence: null });

  const derived = deriveAttendance(
    record.date,
    syntheticPunches,
    record.breaks.map((b) => ({ startAt: b.startAt, endAt: b.endAt })),
    shift,
    newCheckOutAt ?? new Date()
  );
  const finalStatus = status ?? derived.status;

  const changes: Record<string, { from: unknown; to: unknown }> = {};
  if (checkInAt !== undefined && record.checkInAt?.toISOString() !== newCheckInAt?.toISOString()) {
    changes.checkInAt = { from: record.checkInAt, to: newCheckInAt };
  }
  if (checkOutAt !== undefined && record.checkOutAt?.toISOString() !== newCheckOutAt?.toISOString()) {
    changes.checkOutAt = { from: record.checkOutAt, to: newCheckOutAt };
  }
  if (status !== undefined && record.status !== status) {
    changes.status = { from: record.status, to: status };
  }
  if (Object.keys(changes).length === 0) {
    return NextResponse.json({ error: "Nothing actually changed" }, { status: 400 });
  }

  const [updated] = await prisma.$transaction([
    prisma.attendanceRecord.update({
      where: { id: record.id },
      data: {
        checkInAt: newCheckInAt,
        checkOutAt: newCheckOutAt,
        status: finalStatus,
        computedWorkHours: derived.computedWorkHours,
        overtimeHours: derived.overtimeHours,
        isLate: derived.isLate,
        isEarlyDeparture: derived.isEarlyDeparture,
        isManualEntry: true,
        correctionReason: reason,
        correctedById: session.userId,
        correctedAt: new Date(),
      },
      include: { punches: { orderBy: { at: "asc" } }, breaks: { orderBy: { startAt: "asc" } }, user: { select: { name: true, email: true } } },
    }),
    prisma.attendanceAuditLog.create({
      data: {
        tenantId: session.tenantId,
        recordId: record.id,
        editedById: session.userId,
        reason,
        changes: JSON.stringify(changes),
      },
    }),
  ]);

  return NextResponse.json(updated);
}
