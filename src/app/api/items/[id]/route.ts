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
  if (!(await can(session.tenantId, session.roleId, "items", "edit"))) return NextResponse.json({ error: "View-only access" }, { status: 403 });

  const { id } = await params;
  const body = await request.json();

  if (!body.name || !body.hsnCode || !body.unit || !(body.salePrice >= 0) || !(body.taxRate >= 0)) {
    return NextResponse.json({ error: "name, hsnCode, unit, salePrice, taxRate are required" }, { status: 400 });
  }

  const item = await prisma.item.findFirst({ where: { id, tenantId: session.tenantId } });
  if (!item) {
    return NextResponse.json({ error: "Item not found" }, { status: 404 });
  }

  const updated = await prisma.item.update({
    where: { id },
    data: {
      name: body.name,
      description: body.description !== undefined ? body.description || null : item.description,
      hsnCode: body.hsnCode,
      unit: body.unit,
      salePrice: body.salePrice,
      purchasePrice: body.purchasePrice ?? item.purchasePrice,
      taxRate: body.taxRate,
    },
  });

  return NextResponse.json(updated);
}
