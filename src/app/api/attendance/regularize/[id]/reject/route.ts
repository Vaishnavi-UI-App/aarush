import { NextRequest, NextResponse } from "next/server";
import { requireSession, SessionError } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/permissions";

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

  const reg = await prisma.attendanceRegularization.findFirst({ where: { id, tenantId: session.tenantId } });
  if (!reg) return NextResponse.json({ error: "Regularization request not found" }, { status: 404 });
  if (reg.status !== "PENDING") return NextResponse.json({ error: "This request has already been reviewed" }, { status: 400 });

  const updated = await prisma.attendanceRegularization.update({
    where: { id: reg.id },
    data: { status: "REJECTED", reviewedById: session.userId, reviewedAt: new Date(), reviewNote },
    include: { user: { select: { name: true, email: true } } },
  });

  return NextResponse.json(updated);
}
