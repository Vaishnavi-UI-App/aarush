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

  const { id: transactionId } = await params;
  const body = await request.json();
  const { paymentId, vendorPaymentId } = body;

  if (!paymentId && !vendorPaymentId) {
    return NextResponse.json({ error: "paymentId or vendorPaymentId is required" }, { status: 400 });
  }

  const transaction = await prisma.bankTransaction.findFirst({
    where: { id: transactionId, bankAccount: { tenantId: session.tenantId } },
  });
  if (!transaction) return NextResponse.json({ error: "Bank transaction not found" }, { status: 404 });

  if (paymentId) {
    const payment = await prisma.payment.findFirst({ where: { id: paymentId, tenantId: session.tenantId } });
    if (!payment) return NextResponse.json({ error: "Payment not found" }, { status: 404 });
  }
  if (vendorPaymentId) {
    const vendorPayment = await prisma.vendorPayment.findFirst({ where: { id: vendorPaymentId, tenantId: session.tenantId } });
    if (!vendorPayment) return NextResponse.json({ error: "Vendor payment not found" }, { status: 404 });
  }

  try {
    const updated = await prisma.bankTransaction.update({
      where: { id: transactionId },
      data: {
        matchStatus: "MATCHED",
        matchedPaymentId: paymentId || null,
        matchedVendorPaymentId: vendorPaymentId || null,
      },
    });
    return NextResponse.json(updated);
  } catch (e) {
    console.error("Failed to match bank transaction:", e);
    return NextResponse.json({ error: "That payment is already matched to another transaction" }, { status: 400 });
  }
}
