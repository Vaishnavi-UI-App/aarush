import { NextRequest, NextResponse } from "next/server";
import { requireSession, SessionError } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/permissions";
import { DispatchDetailsInput, InvoiceLineInput, updateSaleInvoice } from "@/lib/gst-invoice";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  let session;
  try {
    session = requireSession(request);
  } catch (e) {
    if (e instanceof SessionError) return NextResponse.json({ error: e.message }, { status: 401 });
    throw e;
  }

  const { id } = await params;

  // Scoped by tenantId from the session -- a client cannot fetch another tenant's invoice
  // by guessing an id, even though ids are UUIDs.
  const invoice = await prisma.invoice.findFirst({
    where: { id, tenantId: session.tenantId },
    include: {
      lines: { orderBy: { srNo: "asc" } },
      customer: true,
      payments: true,
    },
  });

  if (!invoice) {
    return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
  }

  return NextResponse.json(invoice);
}

interface UpdateInvoiceBody extends Omit<DispatchDetailsInput, "poDate"> {
  lines: InvoiceLineInput[];
  discount?: number;
  dueDate?: string;
  poDate?: string;
  date?: string;
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  let session;
  try {
    session = requireSession(request);
  } catch (e) {
    if (e instanceof SessionError) return NextResponse.json({ error: e.message }, { status: 401 });
    throw e;
  }
  if (!(await can(session.tenantId, session.roleId, "invoices", "edit"))) return NextResponse.json({ error: "View-only access" }, { status: 403 });

  const { id } = await params;
  const body: UpdateInvoiceBody = await request.json();

  if (!Array.isArray(body.lines) || body.lines.length === 0) {
    return NextResponse.json({ error: "A non-empty lines[] is required" }, { status: 400 });
  }
  for (const line of body.lines) {
    if (!line.description || !line.hsnCode || !(line.qty > 0) || !(line.rate >= 0) || !(line.taxRate >= 0)) {
      return NextResponse.json({ error: "Each line requires description, hsnCode, qty > 0, rate >= 0, taxRate >= 0" }, { status: 400 });
    }
  }

  try {
    const invoice = await updateSaleInvoice({
      tenantId: session.tenantId,
      invoiceId: id,
      lines: body.lines,
      discount: body.discount,
      dueDate: body.dueDate ? new Date(body.dueDate) : undefined,
      date: body.date ? new Date(body.date) : undefined,
      poNumber: body.poNumber,
      poDate: body.poDate ? new Date(body.poDate) : undefined,
      vehicleNumber: body.vehicleNumber,
      transportationMode: body.transportationMode,
      reverseCharge: body.reverseCharge,
      deliveredThrough: body.deliveredThrough,
      placeOfSupplySite: body.placeOfSupplySite,
      siteId: body.siteId,
      paymentTerms: body.paymentTerms,
      shipToSameAsBilling: body.shipToSameAsBilling,
      shipToName: body.shipToName,
      shipToAddress: body.shipToAddress,
      shipToGstin: body.shipToGstin,
      shipToStateCode: body.shipToStateCode,
    });
    return NextResponse.json(invoice);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Could not update this invoice";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
