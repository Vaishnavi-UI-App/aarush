import { NextRequest, NextResponse } from "next/server";
import { requireSession, SessionError } from "@/lib/session";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  let session;
  try {
    session = requireSession(request);
  } catch (e) {
    if (e instanceof SessionError) return NextResponse.json({ error: e.message }, { status: 401 });
    throw e;
  }

  const { id } = await params;
  const purchase = await prisma.purchase.findFirst({ where: { id, tenantId: session.tenantId } });
  if (!purchase) {
    return NextResponse.json({ error: "Purchase bill not found" }, { status: 404 });
  }

  const updated = await prisma.purchase.update({ where: { id }, data: { archivedAt: new Date() } });
  return NextResponse.json(updated);
}
