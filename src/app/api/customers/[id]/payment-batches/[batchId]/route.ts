import { NextRequest, NextResponse } from "next/server";
import { requireSession, SessionError } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/permissions";
import { deleteCustomerPaymentBatch } from "@/lib/customer-payment";

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string; batchId: string }> }) {
  let session;
  try {
    session = requireSession(request);
  } catch (e) {
    if (e instanceof SessionError) return NextResponse.json({ error: e.message }, { status: 401 });
    throw e;
  }
  if (!(await can(session.tenantId, session.roleId, "customers", "delete"))) {
    return NextResponse.json({ error: "View-only access" }, { status: 403 });
  }

  const { id: customerId, batchId } = await params;
  const count = await prisma.payment.count({ where: { tenantId: session.tenantId, customerId, batchId } });
  if (count === 0) return NextResponse.json({ error: "Payment batch not found" }, { status: 404 });

  try {
    await deleteCustomerPaymentBatch(session.tenantId, batchId);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Could not delete payment batch" }, { status: 400 });
  }
}
