import { NextRequest, NextResponse } from "next/server";
import { requireSession, SessionError } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/permissions";

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  let session;
  try {
    session = requireSession(request);
  } catch (e) {
    if (e instanceof SessionError) return NextResponse.json({ error: e.message }, { status: 401 });
    throw e;
  }
  if (!(await can(session.tenantId, session.roleId, "banking", "delete"))) {
    return NextResponse.json({ error: "View-only access" }, { status: 403 });
  }

  const { id } = await params;
  const transaction = await prisma.bankTransaction.findFirst({
    where: { id, bankAccount: { tenantId: session.tenantId } },
  });
  if (!transaction) return NextResponse.json({ error: "Bank transaction not found" }, { status: 404 });

  await prisma.bankTransaction.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
