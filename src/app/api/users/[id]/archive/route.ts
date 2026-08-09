import { NextRequest, NextResponse } from "next/server";
import { requireSession, SessionError } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { canManageUsers } from "@/lib/permissions";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  let session;
  try {
    session = requireSession(request);
  } catch (e) {
    if (e instanceof SessionError) return NextResponse.json({ error: e.message }, { status: 401 });
    throw e;
  }
  if (!(await canManageUsers(session.tenantId, session.roleId))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  if (id === session.userId) {
    return NextResponse.json({ error: "You can't deactivate your own account" }, { status: 400 });
  }

  const user = await prisma.user.findFirst({ where: { id, tenantId: session.tenantId }, include: { roleRef: true } });
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  if (user.roleRef?.isOwner) {
    const activeOwners = await prisma.user.count({
      where: { tenantId: session.tenantId, archivedAt: null, roleRef: { isOwner: true } },
    });
    if (activeOwners <= 1) {
      return NextResponse.json({ error: "Can't deactivate the only remaining Owner" }, { status: 400 });
    }
  }

  const updated = await prisma.user.update({ where: { id }, data: { archivedAt: new Date() } });
  return NextResponse.json(updated);
}
