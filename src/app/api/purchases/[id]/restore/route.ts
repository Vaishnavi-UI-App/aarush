import { NextRequest, NextResponse } from "next/server";
import { requireSession, SessionError } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { canWrite } from "@/lib/permissions";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  let session;
  try {
    session = requireSession(request);
  } catch (e) {
    if (e instanceof SessionError) return NextResponse.json({ error: e.message }, { status: 401 });
    throw e;
  }
  if (!(await canWrite(session.tenantId, session.role))) return NextResponse.json({ error: "View-only access" }, { status: 403 });

  const { id } = await params;
  const purchase = await prisma.purchase.findFirst({ where: { id, tenantId: session.tenantId } });
  if (!purchase) {
    return NextResponse.json({ error: "Purchase bill not found" }, { status: 404 });
  }

  const updated = await prisma.purchase.update({ where: { id }, data: { archivedAt: null } });
  return NextResponse.json(updated);
}
