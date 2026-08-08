import { NextRequest, NextResponse } from "next/server";
import { requireSession, SessionError } from "@/lib/session";
import { recordVendorPayment } from "@/lib/purchase";
import { can } from "@/lib/permissions";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  let session;
  try {
    session = requireSession(request);
  } catch (e) {
    if (e instanceof SessionError) return NextResponse.json({ error: e.message }, { status: 401 });
    throw e;
  }
  if (!(await can(session.tenantId, session.roleId, "vendors", "add"))) return NextResponse.json({ error: "View-only access" }, { status: 403 });

  const { id: vendorId } = await params;
  const body = await request.json();

  if (!(body.amount > 0) || !body.mode) {
    return NextResponse.json({ error: "amount > 0 and mode are required" }, { status: 400 });
  }

  try {
    const payment = await recordVendorPayment({
      tenantId: session.tenantId,
      vendorId,
      purchaseId: body.purchaseId || undefined,
      amount: body.amount,
      mode: body.mode,
      referenceNo: body.referenceNo || undefined,
    });
    return NextResponse.json(payment, { status: 201 });
  } catch (e) {
    console.error("Failed to record vendor payment:", e);
    return NextResponse.json({ error: "Could not record vendor payment" }, { status: 400 });
  }
}
