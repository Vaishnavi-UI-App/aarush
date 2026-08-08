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
  if (!(await can(session.tenantId, session.roleId, "invoices", "delete"))) return NextResponse.json({ error: "View-only access" }, { status: 403 });

  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const note = typeof body?.note === "string" ? body.note.trim() : "";

  const invoice = await prisma.invoice.findFirst({ where: { id, tenantId: session.tenantId } });
  if (!invoice) {
    return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
  }

  const updated = await prisma.invoice.update({
    where: { id },
    data: { archivedAt: new Date(), archiveNote: note || null },
  });

  return NextResponse.json(updated);
}
