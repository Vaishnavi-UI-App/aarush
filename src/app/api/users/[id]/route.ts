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
  if (!(await canManageUsers(session.tenantId, session.roleId))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  if (!body.roleId || typeof body.roleId !== "string") {
    return NextResponse.json({ error: "A valid role is required" }, { status: 400 });
  }
  if (body.siteId !== undefined && body.siteId !== null && typeof body.siteId !== "string") {
    return NextResponse.json({ error: "siteId must be a string or null" }, { status: 400 });
  }
  if (body.monthlySalary !== undefined && body.monthlySalary !== null && !(typeof body.monthlySalary === "number" && body.monthlySalary >= 0)) {
    return NextResponse.json({ error: "monthlySalary must be a non-negative number or null" }, { status: 400 });
  }

  const role = await prisma.role.findFirst({ where: { id: body.roleId, tenantId: session.tenantId } });
  if (!role) {
    return NextResponse.json({ error: "That role doesn't exist" }, { status: 400 });
  }
  if (id === session.userId && !role.isOwner) {
    return NextResponse.json({ error: "You can't remove your own Owner access" }, { status: 400 });
  }
  if (body.siteId) {
    const site = await prisma.site.findFirst({ where: { id: body.siteId, tenantId: session.tenantId } });
    if (!site) {
      return NextResponse.json({ error: "That site doesn't exist" }, { status: 400 });
    }
  }

  const existing = await prisma.user.findFirst({ where: { id, tenantId: session.tenantId } });
  if (!existing) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const user = await prisma.user.update({
    where: { id },
    data: {
      roleId: role.id,
      name: typeof body.name === "string" ? body.name : undefined,
      siteId: body.siteId !== undefined ? body.siteId || null : undefined,
      monthlySalary: body.monthlySalary !== undefined ? body.monthlySalary : undefined,
    },
    select: {
      id: true,
      name: true,
      email: true,
      roleId: true,
      roleRef: { select: { name: true } },
      siteId: true,
      site: { select: { name: true } },
      createdAt: true,
      monthlySalary: true,
    },
  });

  return NextResponse.json(user);
}
