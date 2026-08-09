import { NextRequest, NextResponse } from "next/server";
import { requireSession, SessionError } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/permissions";

export async function GET(request: NextRequest) {
  let session;
  try {
    session = requireSession(request);
  } catch (e) {
    if (e instanceof SessionError) return NextResponse.json({ error: e.message }, { status: 401 });
    throw e;
  }

  const vendors = await prisma.vendor.findMany({
    where: { tenantId: session.tenantId, archivedAt: null },
    orderBy: { name: "asc" },
  });

  return NextResponse.json(vendors);
}

export async function POST(request: NextRequest) {
  let session;
  try {
    session = requireSession(request);
  } catch (e) {
    if (e instanceof SessionError) return NextResponse.json({ error: e.message }, { status: 401 });
    throw e;
  }
  if (!(await can(session.tenantId, session.roleId, "vendors", "add"))) return NextResponse.json({ error: "View-only access" }, { status: 403 });

  const body = await request.json();
  if (!body.name || !body.stateCode) {
    return NextResponse.json({ error: "name and stateCode are required" }, { status: 400 });
  }

  const vendor = await prisma.vendor.create({
    data: {
      tenantId: session.tenantId,
      name: body.name,
      gstin: body.gstin || null,
      stateCode: body.stateCode,
      address: body.address || null,
      email: body.email || null,
      phone: body.phone || null,
    },
  });

  return NextResponse.json(vendor, { status: 201 });
}
