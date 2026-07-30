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

  const invoice = await prisma.invoice.findFirst({ where: { id, tenantId: session.tenantId } });
  if (!invoice) {
    return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
  }

  const updated = await prisma.invoice.update({
    where: { id },
    data: { archivedAt: null },
  });

  return NextResponse.json(updated);
}
