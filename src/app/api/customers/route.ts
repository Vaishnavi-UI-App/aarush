import { NextRequest, NextResponse } from "next/server";
import { requireSession, SessionError } from "@/lib/session";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  let session;
  try {
    session = requireSession(request);
  } catch (e) {
    if (e instanceof SessionError) return NextResponse.json({ error: e.message }, { status: 401 });
    throw e;
  }

  const customers = await prisma.customer.findMany({
    where: { tenantId: session.tenantId },
    orderBy: { name: "asc" },
  });

  return NextResponse.json(customers);
}

export async function POST(request: NextRequest) {
  let session;
  try {
    session = requireSession(request);
  } catch (e) {
    if (e instanceof SessionError) return NextResponse.json({ error: e.message }, { status: 401 });
    throw e;
  }

  const body = await request.json();
  if (!body.name || !body.stateCode) {
    return NextResponse.json({ error: "name and stateCode are required" }, { status: 400 });
  }

  const customer = await prisma.customer.create({
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

  return NextResponse.json(customer, { status: 201 });
}
