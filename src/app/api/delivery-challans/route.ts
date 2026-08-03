import { NextRequest, NextResponse } from "next/server";
import { requireSession, SessionError } from "@/lib/session";
import { createDeliveryChallan, DeliveryChallanLineInput } from "@/lib/delivery-challan";
import { prisma } from "@/lib/prisma";
import { canWrite } from "@/lib/permissions";

export async function GET(request: NextRequest) {
  let session;
  try {
    session = requireSession(request);
  } catch (e) {
    if (e instanceof SessionError) return NextResponse.json({ error: e.message }, { status: 401 });
    throw e;
  }

  const challans = await prisma.deliveryChallan.findMany({
    where: { tenantId: session.tenantId, archivedAt: null },
    include: { customer: { select: { name: true } }, lines: true },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(challans);
}

interface CreateDeliveryChallanBody {
  customerId?: string;
  toName?: string;
  toAddress?: string;
  poNumber?: string;
  poDate?: string;
  vehicleNumber?: string;
  lines: DeliveryChallanLineInput[];
}

export async function POST(request: NextRequest) {
  let session;
  try {
    session = requireSession(request);
  } catch (e) {
    if (e instanceof SessionError) return NextResponse.json({ error: e.message }, { status: 401 });
    throw e;
  }
  if (!(await canWrite(session.tenantId, session.role))) return NextResponse.json({ error: "View-only access" }, { status: 403 });

  const body: CreateDeliveryChallanBody = await request.json();

  if (!Array.isArray(body.lines) || body.lines.length === 0) {
    return NextResponse.json({ error: "A non-empty lines[] is required" }, { status: 400 });
  }
  for (const line of body.lines) {
    if (!line.particulars || !(line.qty > 0)) {
      return NextResponse.json({ error: "Each line requires particulars and qty > 0" }, { status: 400 });
    }
  }

  try {
    // tenantId comes from the verified session, never from the request body.
    const challan = await createDeliveryChallan({
      tenantId: session.tenantId,
      customerId: body.customerId || undefined,
      toName: body.toName,
      toAddress: body.toAddress,
      poNumber: body.poNumber,
      poDate: body.poDate ? new Date(body.poDate) : undefined,
      vehicleNumber: body.vehicleNumber,
      lines: body.lines,
    });
    return NextResponse.json(challan, { status: 201 });
  } catch (e) {
    console.error("Failed to create delivery challan:", e);
    return NextResponse.json({ error: "Could not create delivery challan" }, { status: 400 });
  }
}
