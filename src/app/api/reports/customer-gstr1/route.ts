import { NextRequest, NextResponse } from "next/server";
import { requireSession, SessionError } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/permissions";
import { round2 } from "@/lib/gst-invoice";
import {
  Gstr1Invoice,
  buildB2b,
  buildB2cl,
  buildB2cs,
  buildDocsSummary,
  buildHsnSummary,
  classifyInvoice,
} from "@/lib/gstr1";
import { buildGstr1Workbook } from "@/lib/gstr1-excel";

/** Parses a "YYYY-MM-DD" input into a UTC day boundary. Invoice dates are stored as
 * UTC midnights, so anchoring the range the same way keeps an invoice dated on the
 * first or last day of the period from falling outside it. */
function dayBoundary(value: string, end: boolean): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value?.trim() ?? "");
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const ms = end ? Date.UTC(y, mo - 1, d, 23, 59, 59, 999) : Date.UTC(y, mo - 1, d);
  const date = new Date(ms);
  return Number.isNaN(date.getTime()) || date.getUTCMonth() !== mo - 1 ? null : date;
}

export async function POST(request: NextRequest) {
  let session;
  try {
    session = requireSession(request);
  } catch (e) {
    if (e instanceof SessionError) return NextResponse.json({ error: e.message }, { status: 401 });
    throw e;
  }

  if (!(await can(session.tenantId, session.roleId, "accounts", "view"))) {
    return NextResponse.json({ error: "You don't have access to this report" }, { status: 403 });
  }

  let body: { customerId?: string; fromDate?: string; toDate?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const from = dayBoundary(body.fromDate ?? "", false);
  const to = dayBoundary(body.toDate ?? "", true);
  if (!from || !to) return NextResponse.json({ error: "Enter a valid from and to date" }, { status: 400 });
  if (from > to) return NextResponse.json({ error: "From date must be on or before the to date" }, { status: 400 });

  const company = await prisma.tenant.findUnique({
    where: { id: session.tenantId },
    select: { name: true, gstin: true, stateCode: true, phone: true },
  });
  if (!company) return NextResponse.json({ error: "Company details not found" }, { status: 404 });

  // Only SALE invoices are outward supplies for GSTR-1. Proformas and quotations aren't
  // tax invoices at all, and credit notes belong to a different table of the return
  // (CDNR) rather than these sheets. Drafts were never issued; archived ones have been
  // taken off the books.
  const invoices = await prisma.invoice.findMany({
    where: {
      tenantId: session.tenantId,
      type: "SALE",
      archivedAt: null,
      status: { not: "DRAFT" },
      date: { gte: from, lte: to },
    },
    include: {
      // The return spans every customer for the period, so each invoice brings its own
      // buyer along -- that decides which sheet it lands on and whose GSTIN is reported.
      customer: { select: { name: true, gstin: true, stateCode: true } },
      lines: {
        select: {
          hsnCode: true,
          description: true,
          unit: true,
          qty: true,
          taxableValue: true,
          discountAmount: true,
          taxRate: true,
          cgstAmount: true,
          sgstAmount: true,
          igstAmount: true,
        },
      },
    },
    orderBy: [{ date: "asc" }, { number: "asc" }],
  });

  if (invoices.length === 0) {
    return NextResponse.json(
      { error: `No invoices were raised between ${body.fromDate} and ${body.toDate}.` },
      { status: 404 }
    );
  }

  const issued: Gstr1Invoice[] = invoices.map((inv) => ({
    number: inv.number,
    date: inv.date,
    total: Number(inv.total),
    cancelled: inv.status === "CANCELLED",
    customer: { name: inv.customer.name, gstin: inv.customer.gstin, stateCode: inv.customer.stateCode },
    // Place of supply is where the goods went: the ship-to state when it differs from
    // the billing address, otherwise the customer's own state.
    placeOfSupplyStateCode: inv.shipToStateCode || inv.customer.stateCode,
    reverseCharge: inv.reverseCharge,
    lines: inv.lines.map((l) => ({
      hsnCode: l.hsnCode,
      description: l.description,
      unit: l.unit,
      qty: Number(l.qty),
      // The value GST was actually charged on: a discount shown on the invoice is
      // excluded from the value of supply, so the return must report it net.
      taxableValue: round2(Number(l.taxableValue) - Number(l.discountAmount)),
      taxRate: Number(l.taxRate),
      cgstAmount: Number(l.cgstAmount),
      sgstAmount: Number(l.sgstAmount),
      igstAmount: Number(l.igstAmount),
    })),
  }));

  // Cancelled invoices still count towards the documents summary -- the series has to
  // be accounted for -- but carry no supply, so they stay out of the tax sheets.
  const live = issued.filter((i) => !i.cancelled);
  if (live.length === 0) {
    return NextResponse.json(
      { error: `Every invoice in this period is cancelled, so there is nothing to report.` },
      { status: 404 }
    );
  }

  const byType = { b2b: [] as Gstr1Invoice[], b2cl: [] as Gstr1Invoice[], b2cs: [] as Gstr1Invoice[] };
  for (const inv of live) byType[classifyInvoice(inv, company.stateCode)].push(inv);

  const workbook = await buildGstr1Workbook({
    company,
    fromDate: from,
    toDate: to,
    invoices: live,
    b2b: buildB2b(byType.b2b),
    b2cl: buildB2cl(byType.b2cl),
    b2cs: buildB2cs(byType.b2cs),
    hsn: buildHsnSummary(live),
    docs: buildDocsSummary(issued),
  });

  const filename = `GSTR1_${body.fromDate}_to_${body.toDate}.xlsx`;

  return new NextResponse(new Uint8Array(workbook), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
