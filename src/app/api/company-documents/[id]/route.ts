import { NextRequest, NextResponse } from "next/server";
import { requireSession, SessionError } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { canManageUsers } from "@/lib/permissions";

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  let session;
  try {
    session = requireSession(request);
  } catch (e) {
    if (e instanceof SessionError) return NextResponse.json({ error: e.message }, { status: 401 });
    throw e;
  }
  if (!(await canManageUsers(session.tenantId, session.roleId))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const doc = await prisma.companyDocument.findFirst({ where: { id, tenantId: session.tenantId } });
  if (!doc) {
    return NextResponse.json({ error: "Document not found" }, { status: 404 });
  }

  // Hard delete, unlike Invoice/Customer/Item's archive-only convention -- nothing else
  // in the app references a CompanyDocument, so there's no downstream history to preserve.
  await prisma.companyDocument.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
