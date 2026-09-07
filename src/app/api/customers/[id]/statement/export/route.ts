import { NextRequest, NextResponse } from "next/server";
import { requireSession, SessionError } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { buildTallyLedgerRows, tallyLedgerCsvHeader, tallyLedgerCsvLines } from "@/lib/customer-ledger-report";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  let session;
  try {
    session = requireSession(request);
  } catch (e) {
    if (e instanceof SessionError) return NextResponse.json({ error: e.message }, { status: 401 });
    throw e;
  }

  const { id: customerId } = await params;
  const customer = await prisma.customer.findFirst({ where: { id: customerId, tenantId: session.tenantId } });
  if (!customer) {
    return NextResponse.json({ error: "Customer not found" }, { status: 404 });
  }

  const entries = await prisma.ledgerEntry.findMany({
    where: { tenantId: session.tenantId, customerId },
    orderBy: { createdAt: "asc" },
    include: { invoice: { select: { number: true } }, payment: { select: { mode: true, referenceNo: true, batchId: true } } },
  });

  const rows = buildTallyLedgerRows(
    entries.map((e) => ({
      entryDate: e.entryDate,
      refType: e.refType,
      debit: Number(e.debit),
      credit: Number(e.credit),
      invoiceNumber: e.invoice?.number,
      paymentMode: e.payment?.mode,
      paymentReferenceNo: e.payment?.referenceNo,
      paymentBatchId: e.payment?.batchId,
    }))
  );

  const lines = [tallyLedgerCsvHeader(false), ...tallyLedgerCsvLines(null, rows)];

  // Leading BOM so Excel opens the UTF-8 CSV without mangling non-ASCII characters.
  const csv = "﻿" + lines.join("\r\n");

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${customer.name.replace(/[^a-z0-9]+/gi, "-")}-statement.csv"`,
    },
  });
}
