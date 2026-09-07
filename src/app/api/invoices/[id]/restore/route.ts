import { NextRequest, NextResponse } from "next/server";
import { requireSession, SessionError } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/permissions";
import { restoreInvoiceToLedger } from "@/lib/gst-invoice";

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

  const invoice = await prisma.invoice.findFirst({ where: { id, tenantId: session.tenantId } });
  if (!invoice) {
    return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
  }

  const updated = await prisma.invoice.update({
    where: { id },
    data: { archivedAt: null, archiveNote: null },
  });
  // Bringing the invoice back puts its amount back on the customer's books.
  await restoreInvoiceToLedger(session.tenantId, id);

  return NextResponse.json(updated);
}
