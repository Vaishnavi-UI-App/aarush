import { NextRequest, NextResponse } from "next/server";
import { requireSession, SessionError } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { round2 } from "@/lib/gst-invoice";

type Bucket = "0-30" | "31-60" | "61-90" | "90+";

function bucketFor(days: number): Bucket {
  if (days <= 30) return "0-30";
  if (days <= 60) return "31-60";
  if (days <= 90) return "61-90";
  return "90+";
}

/**
 * Ageing report for outstanding SALE invoices: each unpaid/partially-paid invoice's
 * remaining due is bucketed by days elapsed since its invoice date. This is a
 * per-invoice view (simpler and more actionable for collections) rather than trying
 * to allocate the single running ledger balance back across invoices FIFO-style.
 */
export async function GET(request: NextRequest) {
  let session;
  try {
    session = requireSession(request);
  } catch (e) {
    if (e instanceof SessionError) return NextResponse.json({ error: e.message }, { status: 401 });
    throw e;
  }

  const invoices = await prisma.invoice.findMany({
    where: {
      tenantId: session.tenantId,
      type: "SALE",
      status: { in: ["SENT", "PARTIALLY_PAID", "OVERDUE"] },
      archivedAt: null,
    },
    include: {
      customer: { select: { id: true, name: true } },
      payments: { where: { status: "SUCCESS" } },
    },
    orderBy: { date: "asc" },
  });

  const now = Date.now();
  const buckets: Record<Bucket, number> = { "0-30": 0, "31-60": 0, "61-90": 0, "90+": 0 };

  const rows = invoices
    .map((inv) => {
      const paid = round2(inv.payments.reduce((sum, p) => sum + Number(p.amount), 0));
      const due = round2(Number(inv.total) - paid);
      const days = Math.floor((now - new Date(inv.date).getTime()) / (1000 * 60 * 60 * 24));
      return {
        invoiceId: inv.id,
        number: inv.number,
        customerId: inv.customer.id,
        customerName: inv.customer.name,
        date: inv.date,
        total: Number(inv.total),
        due,
        daysOutstanding: days,
        bucket: bucketFor(days),
      };
    })
    .filter((r) => r.due > 0);

  for (const r of rows) {
    buckets[r.bucket] = round2(buckets[r.bucket] + r.due);
  }

  const totalOutstanding = round2(rows.reduce((sum, r) => sum + r.due, 0));

  return NextResponse.json({ buckets, totalOutstanding, invoices: rows });
}
