import { NextRequest, NextResponse } from "next/server";
import { requireSession, SessionError } from "@/lib/session";
import { prisma } from "@/lib/prisma";

function csvCell(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

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
    include: { invoice: { select: { number: true } } },
  });

  const currentBalance = entries.length > 0 ? Number(entries[entries.length - 1].runningBalance) : 0;
  const currentDue = currentBalance > 0 ? currentBalance : 0;
  const advanceBalance = currentBalance < 0 ? -currentBalance : 0;

  const header = ["Date", "Type", "Description", "Debit", "Credit", "Balance"];
  const lines = [header.map(csvCell).join(",")];
  for (const e of entries) {
    lines.push(
      [
        new Date(e.entryDate).toLocaleDateString("en-IN"),
        e.refType,
        e.description,
        Number(e.debit) > 0 ? Number(e.debit).toFixed(2) : "",
        Number(e.credit) > 0 ? Number(e.credit).toFixed(2) : "",
        Number(e.runningBalance).toFixed(2),
      ]
        .map((v) => csvCell(String(v)))
        .join(",")
    );
  }
  lines.push("");
  lines.push([csvCell("Current Due"), csvCell(currentDue.toFixed(2))].join(","));
  lines.push([csvCell("Advance Balance"), csvCell(advanceBalance.toFixed(2))].join(","));

  // Leading BOM so Excel opens the UTF-8 CSV without mangling non-ASCII characters.
  const csv = "﻿" + lines.join("\r\n");

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${customer.name.replace(/[^a-z0-9]+/gi, "-")}-statement.csv"`,
    },
  });
}
