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
import {
  MAX_JSON_BYTES,
  buildGstr1Json,
  filingPeriod,
  gstJsonFileName,
  jsonByteSize,
  roundJsonMoney,
} from "@/lib/gstr1-json";

interface Body {
  invoiceIds?: string[];
  /** Second call, after the user has seen which bills are already in a JSON. */
  confirmed?: boolean;
}

export async function POST(request: NextRequest) {
  let session;
  try {
    session = requireSession(request);
  } catch (e) {
    if (e instanceof SessionError) return NextResponse.json({ error: e.message }, { status: 401 });
    throw e;
  }

  if (!(await can(session.tenantId, session.roleId, "invoices", "view"))) {
    return NextResponse.json({ error: "You don't have access to invoices" }, { status: 403 });
  }

  let body: Body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const ids = [...new Set(body.invoiceIds ?? [])];
  if (ids.length === 0) return NextResponse.json({ error: "Select at least one bill." }, { status: 400 });

  // Scoped by tenantId, so one tenant can't pull another's invoices by guessing an id.
  const invoices = await prisma.invoice.findMany({
    where: { id: { in: ids }, tenantId: session.tenantId, archivedAt: null },
    include: {
      customer: { select: { name: true, gstin: true, stateCode: true } },
      gstJsonExport: { select: { fileName: true, createdAt: true } },
      lines: {
        select: {
          hsnCode: true, description: true, unit: true, qty: true,
          taxableValue: true, discountAmount: true, taxRate: true,
          cgstAmount: true, sgstAmount: true, igstAmount: true,
        },
      },
    },
    orderBy: [{ date: "asc" }, { number: "asc" }],
  });

  if (invoices.length === 0) return NextResponse.json({ error: "None of those bills could be found." }, { status: 404 });

  // Only a real tax invoice is an outward supply. A proforma or quotation isn't one at
  // all, a draft was never issued, and a credit note belongs to a different table of
  // the return -- putting any of them in the JSON would file something that never
  // happened, so they're rejected by name rather than quietly dropped.
  const notSale = invoices.filter((i) => i.type !== "SALE" || i.status === "DRAFT");
  if (notSale.length > 0) {
    return NextResponse.json(
      {
        error:
          `Only issued sale invoices can go in a GST JSON. Remove: ` +
          notSale.map((i) => i.number).join(", "),
      },
      { status: 400 }
    );
  }

  const company = await prisma.tenant.findUnique({
    where: { id: session.tenantId },
    select: { gstin: true, stateCode: true },
  });
  if (!company) return NextResponse.json({ error: "Company details not found" }, { status: 404 });

  const issued: Gstr1Invoice[] = invoices.map((inv) => ({
    number: inv.number,
    date: inv.date,
    total: Number(inv.total),
    cancelled: inv.status === "CANCELLED",
    customer: { name: inv.customer.name, gstin: inv.customer.gstin, stateCode: inv.customer.stateCode },
    placeOfSupplyStateCode: inv.shipToStateCode || inv.customer.stateCode,
    reverseCharge: inv.reverseCharge,
    lines: inv.lines.map((l) => ({
      hsnCode: l.hsnCode.trim(),
      description: l.description,
      unit: l.unit,
      qty: Number(l.qty),
      // The value GST was charged on: a discount shown on the invoice is excluded from
      // the value of supply, so the return reports it net.
      taxableValue: round2(Number(l.taxableValue) - Number(l.discountAmount)),
      taxRate: Number(l.taxRate),
      cgstAmount: Number(l.cgstAmount),
      sgstAmount: Number(l.sgstAmount),
      igstAmount: Number(l.igstAmount),
    })),
  }));

  // One JSON is one return period. Bills from two months in the same file would be
  // rejected on upload, so it's caught here where the message can be useful.
  const periods = [...new Set(issued.map((i) => filingPeriod(i.date)))];
  if (periods.length > 1) {
    return NextResponse.json(
      {
        error:
          `A GST JSON covers one month. These bills span ${periods.length} months ` +
          `(${periods.sort().join(", ")}) -- select one month at a time.`,
      },
      { status: 400 }
    );
  }

  // Bills already in a JSON: reported back so the user sees which file, then can go
  // ahead if they meant to.
  const already = invoices.filter((i) => i.gstJsonExport);
  if (already.length > 0 && !body.confirmed) {
    return NextResponse.json(
      {
        needsConfirm: true,
        alreadyExported: already.map((i) => ({
          number: i.number,
          jsonName: i.gstJsonExport!.fileName,
          at: i.gstJsonExport!.createdAt,
        })),
      },
      { status: 409 }
    );
  }

  const live = issued.filter((i) => !i.cancelled);
  if (live.length === 0) {
    return NextResponse.json({ error: "Every bill selected is cancelled, so there is nothing to file." }, { status: 400 });
  }

  const byType = { b2b: [] as Gstr1Invoice[], b2cl: [] as Gstr1Invoice[], b2cs: [] as Gstr1Invoice[] };
  for (const inv of live) byType[classifyInvoice(inv, company.stateCode)].push(inv);

  const json = roundJsonMoney(
    buildGstr1Json({
      companyGstin: company.gstin,
      issued,
      live,
      b2b: buildB2b(byType.b2b),
      b2cl: buildB2cl(byType.b2cl),
      b2cs: buildB2cs(byType.b2cs),
      hsn: buildHsnSummary(live),
      docs: buildDocsSummary(issued),
    })
  ) as Record<string, unknown>;

  const bytes = jsonByteSize(json);
  if (bytes > MAX_JSON_BYTES) {
    const mb = (bytes / 1024 / 1024).toFixed(2);
    return NextResponse.json(
      {
        error:
          `This selection makes a ${mb} MB file, over the 3 MB limit. ` +
          `Split it into smaller batches -- ${invoices.length} bills were selected.`,
      },
      { status: 413 }
    );
  }

  const fileName = gstJsonFileName(company.gstin, periods[0]);
  const payload = JSON.stringify(json);

  // Saved and linked in one transaction, only once the file is known to be good -- a
  // rejected attempt never marks anything as exported, and the file is kept in the
  // system so anyone in the tenant can fetch it again rather than it existing only in
  // this user's downloads folder.
  await prisma.$transaction(async (tx) => {
    const saved = await tx.gstJsonExport.create({
      data: {
        tenantId: session.tenantId,
        fileName,
        period: periods[0],
        invoiceCount: invoices.length,
        byteSize: bytes,
        payload,
        createdById: session.userId,
      },
      select: { id: true },
    });
    await tx.invoice.updateMany({
      where: { id: { in: invoices.map((i) => i.id) }, tenantId: session.tenantId },
      data: { gstJsonExportId: saved.id },
    });
  });

  return new NextResponse(payload, {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="${fileName}"`,
      "X-Gst-Json-Name": fileName,
      "X-Gst-Json-Bytes": String(bytes),
    },
  });
}
