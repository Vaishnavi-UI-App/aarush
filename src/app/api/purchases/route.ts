import { NextRequest, NextResponse } from "next/server";
import { requireSession, SessionError } from "@/lib/session";
import { createPurchaseBill } from "@/lib/purchase";
import { InvoiceLineInput } from "@/lib/gst-invoice";
import { prisma } from "@/lib/prisma";

interface CreatePurchaseBody {
  vendorId: string;
  lines: InvoiceLineInput[];
  discount?: number;
  dueDate?: string;
}

export async function GET(request: NextRequest) {
  let session;
  try {
    session = requireSession(request);
  } catch (e) {
    if (e instanceof SessionError) return NextResponse.json({ error: e.message }, { status: 401 });
    throw e;
  }

  const purchases = await prisma.purchase.findMany({
    where: { tenantId: session.tenantId },
    include: { vendor: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(purchases);
}

export async function POST(request: NextRequest) {
  let session;
  try {
    session = requireSession(request);
  } catch (e) {
    if (e instanceof SessionError) return NextResponse.json({ error: e.message }, { status: 401 });
    throw e;
  }

  const body: CreatePurchaseBody = await request.json();

  if (!body.vendorId || !Array.isArray(body.lines) || body.lines.length === 0) {
    return NextResponse.json({ error: "vendorId and a non-empty lines[] are required" }, { status: 400 });
  }
  for (const line of body.lines) {
    if (!line.description || !line.hsnCode || !(line.qty > 0) || !(line.rate >= 0) || !(line.taxRate >= 0)) {
      return NextResponse.json({ error: "Each line requires description, hsnCode, qty > 0, rate >= 0, taxRate >= 0" }, { status: 400 });
    }
  }

  try {
    const purchase = await createPurchaseBill({
      tenantId: session.tenantId,
      vendorId: body.vendorId,
      lines: body.lines,
      discount: body.discount,
      dueDate: body.dueDate ? new Date(body.dueDate) : undefined,
    });
    return NextResponse.json(purchase, { status: 201 });
  } catch (e) {
    console.error("Failed to create purchase bill:", e);
    return NextResponse.json({ error: "Could not create purchase bill for the given vendor" }, { status: 400 });
  }
}
