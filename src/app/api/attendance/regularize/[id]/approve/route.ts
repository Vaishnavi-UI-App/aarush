import { NextRequest, NextResponse } from "next/server";
import { requireSession, SessionError } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/permissions";
import { deriveAttendance, resolveShiftConfig, PunchLike } from "@/lib/attendance";

/** Approves a regularization request: applies the requested check-in/out times to the
 * real AttendanceRecord (creating it if the day never had one at all -- a fully missed
 * punch has no record yet), recomputing status/hours with the exact same
 * deriveAttendance/resolveShiftConfig logic the admin's direct-correction endpoint uses,
 * so a regularized day and a manually-corrected day are computed identically. */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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
  const reviewNote: string | undefined = typeof body.reviewNote === "string" ? body.reviewNote.trim() : undefined;

  const reg = await prisma.attendanceRegularization.findFirst({
    where: { id, tenantId: session.tenantId },
    include: { user: { select: { id: true, roleId: true } } },
  });
  if (!reg) return NextResponse.json({ error: "Regularization request not found" }, { status: 404 });
  if (reg.status !== "PENDING") return NextResponse.json({ error: "This request has already been reviewed" }, { status: 400 });

  const shift = await resolveShiftConfig(session.tenantId, reg.user.roleId);

  const updated = await prisma.$transaction(async (tx) => {
    const existing = await tx.attendanceRecord.findUnique({
      where: { tenantId_userId_date: { tenantId: session!.tenantId, userId: reg.userId, date: reg.date } },
      include: { breaks: { orderBy: { startAt: "asc" } } },
    });

    const newCheckInAt = reg.requestedCheckInAt ?? existing?.checkInAt ?? null;
    const newCheckOutAt = reg.requestedCheckOutAt ?? existing?.checkOutAt ?? null;

    const syntheticPunches: PunchLike[] = [];
    if (newCheckInAt) syntheticPunches.push({ kind: "CHECK_IN", at: newCheckInAt, withinGeofence: null });
    if (newCheckOutAt) syntheticPunches.push({ kind: "CHECK_OUT", at: newCheckOutAt, withinGeofence: null });

    const derived = deriveAttendance(
      reg.date,
      syntheticPunches,
      (existing?.breaks ?? []).map((b) => ({ startAt: b.startAt, endAt: b.endAt })),
      shift,
      newCheckOutAt ?? new Date()
    );

    const correctionReason = `Regularization approved: ${reg.reason}`;

    const record = await tx.attendanceRecord.upsert({
      where: { tenantId_userId_date: { tenantId: session!.tenantId, userId: reg.userId, date: reg.date } },
      create: {
        tenantId: session!.tenantId,
        userId: reg.userId,
        date: reg.date,
        checkInAt: newCheckInAt,
        checkOutAt: newCheckOutAt,
        status: derived.status,
        computedWorkHours: derived.computedWorkHours,
        overtimeHours: derived.overtimeHours,
        isLate: derived.isLate,
        isEarlyDeparture: derived.isEarlyDeparture,
        isManualEntry: true,
        correctionReason,
        correctedById: session!.userId,
        correctedAt: new Date(),
      },
      update: {
        checkInAt: newCheckInAt,
        checkOutAt: newCheckOutAt,
        status: derived.status,
        computedWorkHours: derived.computedWorkHours,
        overtimeHours: derived.overtimeHours,
        isLate: derived.isLate,
        isEarlyDeparture: derived.isEarlyDeparture,
        isManualEntry: true,
        correctionReason,
        correctedById: session!.userId,
        correctedAt: new Date(),
      },
    });

    await tx.attendanceAuditLog.create({
      data: {
        tenantId: session!.tenantId,
        recordId: record.id,
        editedById: session!.userId,
        reason: correctionReason,
        changes: JSON.stringify({
          checkInAt: { from: existing?.checkInAt ?? null, to: newCheckInAt },
          checkOutAt: { from: existing?.checkOutAt ?? null, to: newCheckOutAt },
          status: { from: existing?.status ?? null, to: derived.status },
        }),
      },
    });

    return tx.attendanceRegularization.update({
      where: { id: reg.id },
      data: { status: "APPROVED", reviewedById: session!.userId, reviewedAt: new Date(), reviewNote },
      include: { user: { select: { name: true, email: true } } },
    });
  });

  return NextResponse.json(updated);
}
