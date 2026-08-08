import { NextRequest, NextResponse } from "next/server";
import { requireSession, SessionError } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { canManageUsers } from "@/lib/permissions";

export async function GET(request: NextRequest) {
  let session;
  try {
    session = requireSession(request);
  } catch (e) {
    if (e instanceof SessionError) return NextResponse.json({ error: e.message }, { status: 401 });
    throw e;
  }
  if (!(await canManageUsers(session.tenantId, session.roleId))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const shifts = await prisma.shiftConfig.findMany({
    where: { tenantId: session.tenantId },
    include: { role: { select: { id: true, name: true } } },
    orderBy: [{ roleId: "asc" }, { createdAt: "asc" }],
  });
  return NextResponse.json(shifts);
}

function validateBody(body: Record<string, unknown>) {
  const { name, startTime, endTime, gracePeriodMins, halfDayThresholdHrs, fullDayThresholdHrs, overtimeAfterHrs, roleId } = body;
  if (typeof name !== "string" || !name.trim()) return "name is required";
  if (typeof startTime !== "string" || !/^\d{2}:\d{2}$/.test(startTime)) return "startTime must be HH:MM";
  if (typeof endTime !== "string" || !/^\d{2}:\d{2}$/.test(endTime)) return "endTime must be HH:MM";
  if (typeof gracePeriodMins !== "number" || gracePeriodMins < 0) return "gracePeriodMins must be a non-negative number";
  if (typeof halfDayThresholdHrs !== "number" || halfDayThresholdHrs < 0) return "halfDayThresholdHrs must be a non-negative number";
  if (typeof fullDayThresholdHrs !== "number" || fullDayThresholdHrs < 0) return "fullDayThresholdHrs must be a non-negative number";
  if (typeof overtimeAfterHrs !== "number" || overtimeAfterHrs < 0) return "overtimeAfterHrs must be a non-negative number";
  if (roleId !== undefined && roleId !== null && typeof roleId !== "string") return "roleId must be a string or null";
  return null;
}

export async function POST(request: NextRequest) {
  let session;
  try {
    session = requireSession(request);
  } catch (e) {
    if (e instanceof SessionError) return NextResponse.json({ error: e.message }, { status: 401 });
    throw e;
  }
  if (!(await canManageUsers(session.tenantId, session.roleId))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const error = validateBody(body);
  if (error) return NextResponse.json({ error }, { status: 400 });

  const roleId: string | null = body.roleId || null;
  if (roleId) {
    const role = await prisma.role.findFirst({ where: { id: roleId, tenantId: session.tenantId } });
    if (!role) return NextResponse.json({ error: "Role not found" }, { status: 404 });
  }

  // roleId is part of the compound unique index, so a plain findFirst (not findUnique,
  // which rejects a literal null there) is how we check for an existing row first.
  const existing = await prisma.shiftConfig.findFirst({ where: { tenantId: session.tenantId, roleId } });
  if (existing) {
    return NextResponse.json({ error: roleId ? "This role already has a shift config -- edit it instead" : "A tenant default shift already exists -- edit it instead" }, { status: 409 });
  }

  const shift = await prisma.shiftConfig.create({
    data: {
      tenantId: session.tenantId,
      roleId,
      name: body.name,
      startTime: body.startTime,
      endTime: body.endTime,
      gracePeriodMins: body.gracePeriodMins,
      halfDayThresholdHrs: body.halfDayThresholdHrs,
      fullDayThresholdHrs: body.fullDayThresholdHrs,
      overtimeAfterHrs: body.overtimeAfterHrs,
    },
    include: { role: { select: { id: true, name: true } } },
  });
  return NextResponse.json(shift, { status: 201 });
}
