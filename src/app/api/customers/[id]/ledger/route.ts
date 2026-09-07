import { NextRequest, NextResponse } from "next/server";
import { requireSession, SessionError } from "@/lib/session";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  let session;
  try {
    session = requireSession(request);
  } catch (e) {
    if (e instanceof SessionError) return NextResponse.json({ error: e.message }, { status: 401 });
    throw e;
  }

  const { id: customerId } = await params;

  const customer = await prisma.customer.findFirst({
    where: { id: customerId, tenantId: session.tenantId },
  });
  if (!customer) {
    return NextResponse.json({ error: "Customer not found" }, { status: 404 });
  }

  const entries = await prisma.ledgerEntry.findMany({
    where: { tenantId: session.tenantId, customerId },
    orderBy: { createdAt: "asc" },
    include: {
      invoice: { select: { id: true, number: true, status: true } },
      // batchId is what lets the caller fold a multi-invoice payment's rows back into
      // the single receipt it was -- without it the Banking dashboard's inline ledger
      // modal shows one row per invoice the payment touched.
      payment: { select: { id: true, mode: true, referenceNo: true, batchId: true } },
    },
  });

  const currentDue = entries.length > 0 ? entries[entries.length - 1].runningBalance : 0;

  return NextResponse.json({
    customer: { id: customer.id, name: customer.name, gstin: customer.gstin },
    currentDue,
    entries,
  });
}
