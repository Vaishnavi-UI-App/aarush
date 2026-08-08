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

  const items = await prisma.item.findMany({
    where: { tenantId: session.tenantId, archivedAt: null },
    orderBy: { name: "asc" },
  });

  return NextResponse.json(items);
}

export async function POST(request: NextRequest) {
  let session;
  try {
    session = requireSession(request);
  } catch (e) {
    if (e instanceof SessionError) return NextResponse.json({ error: e.message }, { status: 401 });
    throw e;
  }
  if (!(await can(session.tenantId, session.roleId, "items", "add"))) return NextResponse.json({ error: "View-only access" }, { status: 403 });

  const body = await request.json();
  if (!body.name || !body.hsnCode || !body.unit || !(body.salePrice >= 0) || !(body.taxRate >= 0)) {
    return NextResponse.json({ error: "name, hsnCode, unit, salePrice, taxRate are required" }, { status: 400 });
  }

  const item = await prisma.item.create({
    data: {
      tenantId: session.tenantId,
      name: body.name,
      hsnCode: body.hsnCode,
      unit: body.unit,
      salePrice: body.salePrice,
      purchasePrice: body.purchasePrice ?? null,
      taxRate: body.taxRate,
    },
  });

  return NextResponse.json(item, { status: 201 });
}
