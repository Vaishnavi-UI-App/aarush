import { NextRequest, NextResponse } from "next/server";
import { requireSession, SessionError } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { buildTallyLedgerRows, tallyLedgerCsvHeader, tallyLedgerCsvLines } from "@/lib/customer-ledger-report";

export async function GET(request: NextRequest) {
  let session;
  try {
    session = requireSession(request);
  } catch (e) {
    if (e instanceof SessionError) return NextResponse.json({ error: e.message }, { status: 401 });
    throw e;
  }

  const customers = await prisma.customer.findMany({
    where: { tenantId: session.tenantId, archivedAt: null },
    orderBy: { name: "asc" },
    include: {
      ledgerEntries: {
        orderBy: { createdAt: "asc" },
        include: { invoice: { select: { number: true } }, payment: { select: { mode: true, referenceNo: true } } },
      },
    },
  });

  const lines = [tallyLedgerCsvHeader(true)];
  for (const customer of customers) {
    const rows = buildTallyLedgerRows(
      customer.ledgerEntries.map((e) => ({
        entryDate: e.entryDate,
        refType: e.refType,
        debit: Number(e.debit),
        credit: Number(e.credit),
        invoiceNumber: e.invoice?.number,
        paymentMode: e.payment?.mode,
        paymentReferenceNo: e.payment?.referenceNo,
      }))
    );
    if (rows.length === 0) continue;
    lines.push(...tallyLedgerCsvLines(customer.name, rows));
  }

  // Leading BOM so Excel opens the UTF-8 CSV without mangling non-ASCII characters.
  const csv = "﻿" + lines.join("\r\n");

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="all-customers-statement.csv"`,
    },
  });
}
