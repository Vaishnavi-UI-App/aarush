import { NextRequest, NextResponse } from "next/server";
import { requireSession, SessionError } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/permissions";
import { DeliveryChallanLineInput, updateDeliveryChallan } from "@/lib/delivery-challan";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  let session;
  try {
    session = requireSession(request);
  } catch (e) {
    if (e instanceof SessionError) return NextResponse.json({ error: e.message }, { status: 401 });
    throw e;
  }

  const { id } = await params;

  const challan = await prisma.deliveryChallan.findFirst({
    where: { id, tenantId: session.tenantId },
    include: { lines: true, customer: true },
  });

  if (!challan) {
    return NextResponse.json({ error: "Delivery challan not found" }, { status: 404 });
  }

  return NextResponse.json(challan);
}

interface UpdateDeliveryChallanBody {
  customerId?: string;
  siteId?: string;
  toName?: string;
  toAddress?: string;
  poNumber?: string;
  poDate?: string;
  vehicleNumber?: string;
  lines: DeliveryChallanLineInput[];
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  let session;
  try {
    session = requireSession(request);
  } catch (e) {
    if (e instanceof SessionError) return NextResponse.json({ error: e.message }, { status: 401 });
    throw e;
  }
  if (!(await can(session.tenantId, session.roleId, "deliveryChallans", "edit"))) return NextResponse.json({ error: "View-only access" }, { status: 403 });

  const { id } = await params;
  const body: UpdateDeliveryChallanBody = await request.json();

  if (!Array.isArray(body.lines) || body.lines.length === 0) {
    return NextResponse.json({ error: "A non-empty lines[] is required" }, { status: 400 });
  }
  for (const line of body.lines) {
    if (!line.particulars || !(line.qty > 0)) {
      return NextResponse.json({ error: "Each line requires particulars and qty > 0" }, { status: 400 });
    }
  }

  try {
    const challan = await updateDeliveryChallan({
      tenantId: session.tenantId,
      challanId: id,
      customerId: body.customerId || undefined,
      siteId: body.siteId || undefined,
      toName: body.toName,
      toAddress: body.toAddress,
      poNumber: body.poNumber,
      poDate: body.poDate ? new Date(body.poDate) : undefined,
      vehicleNumber: body.vehicleNumber,
      lines: body.lines,
    });
    return NextResponse.json(challan);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Could not update this delivery challan";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
