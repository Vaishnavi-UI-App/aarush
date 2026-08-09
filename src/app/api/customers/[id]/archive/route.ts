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
  if (!(await can(session.tenantId, session.roleId, "customers", "delete"))) return NextResponse.json({ error: "View-only access" }, { status: 403 });

  const { id } = await params;

  const customer = await prisma.customer.findFirst({ where: { id, tenantId: session.tenantId } });
  if (!customer) {
    return NextResponse.json({ error: "Customer not found" }, { status: 404 });
  }

  const updated = await prisma.customer.update({
    where: { id },
    data: { archivedAt: new Date() },
  });

  return NextResponse.json(updated);
}
