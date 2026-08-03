import { NextRequest, NextResponse } from "next/server";
import { requireSession, SessionError } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { canManageUsers } from "@/lib/permissions";

const VALID_ROLES = ["OWNER", "ACCOUNTANT", "SALES_STAFF", "AUDITOR"];

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  let session;
  try {
    session = requireSession(request);
  } catch (e) {
    if (e instanceof SessionError) return NextResponse.json({ error: e.message }, { status: 401 });
    throw e;
  }
  if (!(await canManageUsers(session.tenantId, session.role))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  if (!VALID_ROLES.includes(body.role)) {
    return NextResponse.json({ error: "A valid role is required" }, { status: 400 });
  }
  if (id === session.userId && body.role !== "OWNER") {
    return NextResponse.json({ error: "You can't remove your own OWNER access" }, { status: 400 });
  }

  const existing = await prisma.user.findFirst({ where: { id, tenantId: session.tenantId } });
  if (!existing) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const user = await prisma.user.update({
    where: { id },
    data: { role: body.role, name: typeof body.name === "string" ? body.name : undefined },
    select: { id: true, name: true, email: true, role: true, createdAt: true },
  });

  return NextResponse.json(user);
}
