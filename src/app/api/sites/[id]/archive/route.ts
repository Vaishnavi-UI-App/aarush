import { NextRequest, NextResponse } from "next/server";
import { requireSession, SessionError } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { canWrite, canAccessFinance } from "@/lib/permissions";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  let session;
  try {
    session = requireSession(request);
  } catch (e) {
    if (e instanceof SessionError) return NextResponse.json({ error: e.message }, { status: 401 });
    throw e;
  }
  if (!(await canWrite(session.tenantId, session.role)) || !(await canAccessFinance(session.tenantId, session.role))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const site = await prisma.site.findFirst({ where: { id, tenantId: session.tenantId } });
  if (!site) {
    return NextResponse.json({ error: "Site not found" }, { status: 404 });
  }

  const updated = await prisma.site.update({ where: { id }, data: { archivedAt: new Date() } });
  return NextResponse.json(updated);
}
