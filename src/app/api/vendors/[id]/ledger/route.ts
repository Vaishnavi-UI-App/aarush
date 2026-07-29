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

  const { id: vendorId } = await params;

  const vendor = await prisma.vendor.findFirst({ where: { id: vendorId, tenantId: session.tenantId } });
  if (!vendor) {
    return NextResponse.json({ error: "Vendor not found" }, { status: 404 });
  }

  const entries = await prisma.ledgerEntry.findMany({
    where: { tenantId: session.tenantId, vendorId },
    orderBy: { createdAt: "asc" },
    include: {
      purchase: { select: { id: true, number: true, status: true } },
      vendorPayment: { select: { id: true, mode: true, referenceNo: true } },
    },
  });

  const currentPayable = entries.length > 0 ? entries[entries.length - 1].runningBalance : 0;

  return NextResponse.json({
    vendor: { id: vendor.id, name: vendor.name, gstin: vendor.gstin },
    currentPayable,
    entries,
  });
}
