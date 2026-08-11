import { NextRequest, NextResponse } from "next/server";
import { requireSession, SessionError } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { can, marksOwnAttendance } from "@/lib/permissions";
import { attendanceDateBucket, MAX_REGULARIZATIONS_PER_MONTH } from "@/lib/attendance";

/** Employee's own requests (?mine=1), or -- for anyone with allAttendance edit rights --
 * every request in the tenant, optionally filtered by status. Two different audiences
 * reading the same table, so one GET with a query flag instead of two near-identical
 * endpoints. */
export async function GET(request: NextRequest) {
  let session;
  try {
    session = requireSession(request);
  } catch (e) {
    if (e instanceof SessionError) return NextResponse.json({ error: e.message }, { status: 401 });
    throw e;
  }

  const mine = request.nextUrl.searchParams.get("mine") === "1";
  const statusFilter = request.nextUrl.searchParams.get("status");

  if (mine) {
    const requests = await prisma.attendanceRegularization.findMany({
      where: { tenantId: session.tenantId, userId: session.userId },
      orderBy: { createdAt: "desc" },
      include: { reviewedBy: { select: { name: true, email: true } } },
    });
    return NextResponse.json(requests);
  }

  if (!(await can(session.tenantId, session.roleId, "allAttendance", "edit"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const requests = await prisma.attendanceRegularization.findMany({
    where: {
      tenantId: session.tenantId,
      ...(statusFilter ? { status: statusFilter as "PENDING" | "APPROVED" | "REJECTED" } : {}),
    },
    orderBy: { createdAt: "desc" },
    include: {
      user: { select: { name: true, email: true } },
      reviewedBy: { select: { name: true, email: true } },
    },
  });
  return NextResponse.json(requests);
}

export async function POST(request: NextRequest) {
  let session;
  try {
    session = requireSession(request);
  } catch (e) {
    if (e instanceof SessionError) return NextResponse.json({ error: e.message }, { status: 401 });
    throw e;
  }
  if (!(await marksOwnAttendance(session.tenantId, session.roleId))) {
    return NextResponse.json({ error: "Your role doesn't track attendance" }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const { date, checkInAt, checkOutAt, reason } = body;

  if (!date || Number.isNaN(Date.parse(date))) {
    return NextResponse.json({ error: "A valid date is required" }, { status: 400 });
  }
  if (typeof reason !== "string" || !reason.trim()) {
    return NextResponse.json({ error: "A reason is required" }, { status: 400 });
  }
  if (!checkInAt && !checkOutAt) {
    return NextResponse.json({ error: "Provide at least a check-in or check-out time" }, { status: 400 });
  }
  if (checkInAt && Number.isNaN(Date.parse(checkInAt))) {
    return NextResponse.json({ error: "checkInAt must be a valid date/time" }, { status: 400 });
  }
  if (checkOutAt && Number.isNaN(Date.parse(checkOutAt))) {
    return NextResponse.json({ error: "checkOutAt must be a valid date/time" }, { status: 400 });
  }

  const dateBucket = attendanceDateBucket(new Date(date));
  const today = attendanceDateBucket();
  if (dateBucket.getTime() > today.getTime()) {
    return NextResponse.json({ error: "Can't request regularization for a future date" }, { status: 400 });
  }

  const existingPending = await prisma.attendanceRegularization.findFirst({
    where: { tenantId: session.tenantId, userId: session.userId, date: dateBucket, status: "PENDING" },
  });
  if (existingPending) {
    return NextResponse.json({ error: "You already have a pending regularization request for that date" }, { status: 400 });
  }

  const monthStart = new Date(Date.UTC(dateBucket.getUTCFullYear(), dateBucket.getUTCMonth(), 1));
  const monthEnd = new Date(Date.UTC(dateBucket.getUTCFullYear(), dateBucket.getUTCMonth() + 1, 1));
  const countThisMonth = await prisma.attendanceRegularization.count({
    where: { tenantId: session.tenantId, userId: session.userId, date: { gte: monthStart, lt: monthEnd } },
  });
  if (countThisMonth >= MAX_REGULARIZATIONS_PER_MONTH) {
    return NextResponse.json(
      { error: `You've already used all ${MAX_REGULARIZATIONS_PER_MONTH} regularization requests allowed for that month` },
      { status: 400 }
    );
  }

  const created = await prisma.attendanceRegularization.create({
    data: {
      tenantId: session.tenantId,
      userId: session.userId,
      date: dateBucket,
      requestedCheckInAt: checkInAt ? new Date(checkInAt) : null,
      requestedCheckOutAt: checkOutAt ? new Date(checkOutAt) : null,
      reason: reason.trim(),
    },
  });

  return NextResponse.json(created, { status: 201 });
}
