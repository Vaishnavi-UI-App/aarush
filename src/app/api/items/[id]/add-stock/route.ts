import { NextRequest, NextResponse } from "next/server";
import { requireSession, SessionError } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/permissions";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  let session;
  try {
    session = requireSession(request);
  } catch (e) {
    if (e instanceof SessionError) return NextResponse.json({ error: e.message }, { status: 401 });
    throw e;
  }
  if (!(await can(session.tenantId, session.roleId, "items", "edit"))) return NextResponse.json({ error: "View-only access" }, { status: 403 });

  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const qty = Number(body.qty);
  if (!Number.isFinite(qty) || qty === 0) {
    return NextResponse.json({ error: "qty must be a non-zero number" }, { status: 400 });
  }

  const item = await prisma.item.findFirst({ where: { id, tenantId: session.tenantId } });
  if (!item) {
    return NextResponse.json({ error: "Item not found" }, { status: 404 });
  }

  const updated = await prisma.item.update({
    where: { id },
    data: { currentStock: { increment: qty } },
  });

  return NextResponse.json(updated);
}
