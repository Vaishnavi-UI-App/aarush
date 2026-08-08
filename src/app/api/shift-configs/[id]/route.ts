import { NextRequest, NextResponse } from "next/server";
import { requireSession, SessionError } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { canManageUsers } from "@/lib/permissions";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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

  const { id } = await params;
  const existing = await prisma.shiftConfig.findFirst({ where: { id, tenantId: session.tenantId } });
  if (!existing) return NextResponse.json({ error: "Shift config not found" }, { status: 404 });

  const body = await request.json().catch(() => ({}));
  const data: Record<string, unknown> = {};
  if (body.name !== undefined) {
    if (typeof body.name !== "string" || !body.name.trim()) return NextResponse.json({ error: "name must be a non-empty string" }, { status: 400 });
    data.name = body.name;
  }
  if (body.startTime !== undefined) {
    if (typeof body.startTime !== "string" || !/^\d{2}:\d{2}$/.test(body.startTime)) return NextResponse.json({ error: "startTime must be HH:MM" }, { status: 400 });
    data.startTime = body.startTime;
  }
  if (body.endTime !== undefined) {
    if (typeof body.endTime !== "string" || !/^\d{2}:\d{2}$/.test(body.endTime)) return NextResponse.json({ error: "endTime must be HH:MM" }, { status: 400 });
    data.endTime = body.endTime;
  }
  for (const field of ["gracePeriodMins", "halfDayThresholdHrs", "fullDayThresholdHrs", "overtimeAfterHrs"] as const) {
    if (body[field] !== undefined) {
      if (typeof body[field] !== "number" || body[field] < 0) return NextResponse.json({ error: `${field} must be a non-negative number` }, { status: 400 });
      data[field] = body[field];
    }
  }

  const shift = await prisma.shiftConfig.update({ where: { id }, data, include: { role: { select: { id: true, name: true } } } });
  return NextResponse.json(shift);
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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

  const { id } = await params;
  const existing = await prisma.shiftConfig.findFirst({ where: { id, tenantId: session.tenantId } });
  if (!existing) return NextResponse.json({ error: "Shift config not found" }, { status: 404 });
  if (existing.roleId === null) {
    return NextResponse.json({ error: "Can't delete the tenant default shift -- edit it instead" }, { status: 400 });
  }

  await prisma.shiftConfig.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
