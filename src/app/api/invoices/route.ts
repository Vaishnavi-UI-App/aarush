import { NextRequest, NextResponse } from "next/server";
import { requireSession, SessionError } from "@/lib/session";
import { BillableInvoiceType, createSaleInvoice, DispatchDetailsInput, InvoiceLineInput } from "@/lib/gst-invoice";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/permissions";

export async function GET(request: NextRequest) {
  let session;
  try {
    session = requireSession(request);
  } catch (e) {
    if (e instanceof SessionError) return NextResponse.json({ error: e.message }, { status: 401 });
    throw e;
  }

  const includeArchived = request.nextUrl.searchParams.get("archived") === "true";

  const invoices = await prisma.invoice.findMany({
    where: { tenantId: session.tenantId, ...(includeArchived ? {} : { archivedAt: null }) },
    include: { customer: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(invoices);
}

interface CreateInvoiceBody extends Omit<DispatchDetailsInput, "poDate"> {
  customerId: string;
  lines: InvoiceLineInput[];
  discount?: number;
  dueDate?: string;
  poDate?: string;
  type?: BillableInvoiceType;
  isServiceInvoice?: boolean;
}

export async function POST(request: NextRequest) {
  let session;
  try {
    session = requireSession(request);
  } catch (e) {
    if (e instanceof SessionError) return NextResponse.json({ error: e.message }, { status: 401 });
    throw e;
  }
  if (!(await can(session.tenantId, session.roleId, "invoices", "add"))) return NextResponse.json({ error: "View-only access" }, { status: 403 });

  const body: CreateInvoiceBody = await request.json();

  if (!body.customerId || !Array.isArray(body.lines) || body.lines.length === 0) {
    return NextResponse.json({ error: "customerId and a non-empty lines[] are required" }, { status: 400 });
  }
  if (body.type && body.type !== "SALE" && body.type !== "PROFORMA" && body.type !== "QUOTATION") {
    return NextResponse.json({ error: "type must be SALE, PROFORMA, or QUOTATION" }, { status: 400 });
  }

  for (const line of body.lines) {
    if (!line.description || !line.hsnCode || !(line.qty > 0) || !(line.rate >= 0) || !(line.taxRate >= 0)) {
      return NextResponse.json({ error: "Each line requires description, hsnCode, qty > 0, rate >= 0, taxRate >= 0" }, { status: 400 });
    }
  }

  try {
    // tenantId comes from the verified session, never from the request body.
    const invoice = await createSaleInvoice({
      tenantId: session.tenantId,
      customerId: body.customerId,
      lines: body.lines,
      discount: body.discount,
      dueDate: body.dueDate ? new Date(body.dueDate) : undefined,
      type: body.type,
      isServiceInvoice: body.isServiceInvoice,
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
    return NextResponse.json(invoice, { status: 201 });
  } catch (e) {
    console.error("Failed to create invoice:", e);
    return NextResponse.json({ error: "Could not create invoice for the given customer" }, { status: 400 });
  }
}
