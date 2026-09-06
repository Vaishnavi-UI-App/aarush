import { NextRequest, NextResponse } from "next/server";
import { requireSession, SessionError } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/permissions";
import { deleteCustomerPayment } from "@/lib/customer-payment";

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string; paymentId: string }> }) {
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

  const { id: customerId, paymentId } = await params;
  const payment = await prisma.payment.findFirst({ where: { id: paymentId, tenantId: session.tenantId, customerId } });
  if (!payment) return NextResponse.json({ error: "Payment not found" }, { status: 404 });

  try {
    await deleteCustomerPayment(session.tenantId, paymentId);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Could not delete payment" }, { status: 400 });
  }
}
