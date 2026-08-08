import { NextRequest, NextResponse } from "next/server";
import { requireSession, SessionError } from "@/lib/session";
import { recordCustomerPayment, recordCustomerPaymentAllocations } from "@/lib/customer-payment";
import { can } from "@/lib/permissions";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  let session;
  try {
    session = requireSession(request);
  } catch (e) {
    if (e instanceof SessionError) return NextResponse.json({ error: e.message }, { status: 401 });
    throw e;
  }
  if (!(await can(session.tenantId, session.roleId, "customers", "add"))) return NextResponse.json({ error: "View-only access" }, { status: 403 });

  const { id: customerId } = await params;
  const body = await request.json();

  // A single payment split across several invoices (or a general/unapplied credit
  // when an entry omits invoiceId) -- e.g. clearing two older bills and putting the
  // rest toward a third, all from one amount the customer handed over.
  if (Array.isArray(body.allocations)) {
    if (body.allocations.length === 0 || !body.mode) {
      return NextResponse.json({ error: "At least one allocation and mode are required" }, { status: 400 });
    }
    for (const a of body.allocations) {
      if (!(a.amount > 0)) {
        return NextResponse.json({ error: "Each allocation amount must be greater than zero" }, { status: 400 });
      }
    }
    try {
      const payments = await recordCustomerPaymentAllocations(
        session.tenantId,
        customerId,
        body.mode,
        body.referenceNo || undefined,
        body.allocations.map((a: { invoiceId?: string; amount: number }) => ({
          invoiceId: a.invoiceId || undefined,
          amount: a.amount,
        }))
      );
      return NextResponse.json(payments, { status: 201 });
    } catch (e) {
      console.error("Failed to record customer payment allocations:", e);
      return NextResponse.json({ error: "Could not record payment" }, { status: 400 });
    }
  }

  if (!(body.amount > 0) || !body.mode) {
    return NextResponse.json({ error: "amount > 0 and mode are required" }, { status: 400 });
  }

  try {
    const payment = await recordCustomerPayment({
      tenantId: session.tenantId,
      customerId,
      invoiceId: body.invoiceId || undefined,
      amount: body.amount,
      mode: body.mode,
      referenceNo: body.referenceNo || undefined,
    });
    return NextResponse.json(payment, { status: 201 });
  } catch (e) {
    console.error("Failed to record customer payment:", e);
    return NextResponse.json({ error: "Could not record payment" }, { status: 400 });
  }
}
