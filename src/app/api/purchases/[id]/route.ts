import { NextRequest, NextResponse } from "next/server";
import { requireSession, SessionError } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/permissions";
import { InvoiceLineInput } from "@/lib/gst-invoice";
import { updatePurchaseBill } from "@/lib/purchase";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  let session;
  try {
    session = requireSession(request);
  } catch (e) {
    if (e instanceof SessionError) return NextResponse.json({ error: e.message }, { status: 401 });
    throw e;
  }

  const { id } = await params;

  const purchase = await prisma.purchase.findFirst({
    where: { id, tenantId: session.tenantId },
    include: { lines: true, vendor: true, vendorPayments: true },
  });

  if (!purchase) {
    return NextResponse.json({ error: "Purchase bill not found" }, { status: 404 });
  }

  return NextResponse.json(purchase);
}

interface UpdatePurchaseBody {
  lines: InvoiceLineInput[];
  discount?: number;
  dueDate?: string;
  vendorBillNumber?: string;
  siteId?: string;
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  let session;
  try {
    session = requireSession(request);
  } catch (e) {
    if (e instanceof SessionError) return NextResponse.json({ error: e.message }, { status: 401 });
    throw e;
  }
  if (!(await can(session.tenantId, session.roleId, "purchases", "edit"))) return NextResponse.json({ error: "View-only access" }, { status: 403 });

  const { id } = await params;
  const body: UpdatePurchaseBody = await request.json();

  if (!Array.isArray(body.lines) || body.lines.length === 0) {
    return NextResponse.json({ error: "A non-empty lines[] is required" }, { status: 400 });
  }
  for (const line of body.lines) {
    if (!line.description || !line.hsnCode || !(line.qty > 0) || !(line.rate >= 0) || !(line.taxRate >= 0)) {
      return NextResponse.json({ error: "Each line requires description, hsnCode, qty > 0, rate >= 0, taxRate >= 0" }, { status: 400 });
    }
  }

  try {
    const purchase = await updatePurchaseBill({
      tenantId: session.tenantId,
      purchaseId: id,
      lines: body.lines,
      discount: body.discount,
      dueDate: body.dueDate ? new Date(body.dueDate) : undefined,
      vendorBillNumber: body.vendorBillNumber,
      siteId: body.siteId,
    });
    return NextResponse.json(purchase);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Could not update this purchase bill";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
