import { NextRequest, NextResponse } from "next/server";
import { requireSession, SessionError } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/permissions";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  let session;
  try {
    session = requireSession(request);
  } catch (e) {
    if (e instanceof SessionError) return NextResponse.json({ error: e.message }, { status: 401 });
    throw e;
  }
  if (!(await can(session.tenantId, session.roleId, "vendors", "edit"))) return NextResponse.json({ error: "View-only access" }, { status: 403 });

  const { id } = await params;
  const body = await request.json();

  if (!body.name || !body.stateCode) {
    return NextResponse.json({ error: "name and stateCode are required" }, { status: 400 });
  }

  const vendor = await prisma.vendor.findFirst({ where: { id, tenantId: session.tenantId } });
  if (!vendor) {
    return NextResponse.json({ error: "Vendor not found" }, { status: 404 });
  }

  const updated = await prisma.vendor.update({
    where: { id },
    data: {
      name: body.name,
      stateCode: body.stateCode,
      gstin: body.gstin || null,
      phone: body.phone || null,
      email: body.email || null,
      address: body.address || null,
    },
  });

  return NextResponse.json(updated);
}
