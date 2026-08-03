import { NextRequest, NextResponse } from "next/server";
import { requireSession, SessionError } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { canWrite } from "@/lib/permissions";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  let session;
  try {
    session = requireSession(request);
  } catch (e) {
    if (e instanceof SessionError) return NextResponse.json({ error: e.message }, { status: 401 });
    throw e;
  }
  if (!(await canWrite(session.tenantId, session.role))) return NextResponse.json({ error: "View-only access" }, { status: 403 });

  const { id } = await params;
  const body = await request.json();
  if (!body.name || !body.stateCode) {
    return NextResponse.json({ error: "name and stateCode are required" }, { status: 400 });
  }

  const existing = await prisma.customer.findFirst({ where: { id, tenantId: session.tenantId } });
  if (!existing) {
    return NextResponse.json({ error: "Customer not found" }, { status: 404 });
  }

  const customer = await prisma.customer.update({
    where: { id },
    data: {
      name: body.name,
      gstin: body.gstin || null,
      stateCode: body.stateCode,
      address: body.address || null,
      email: body.email || null,
      phone: body.phone || null,
    },
  });

  return NextResponse.json(customer);
}
