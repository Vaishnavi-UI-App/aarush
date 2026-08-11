import { NextRequest, NextResponse } from "next/server";
import { requireSession, SessionError } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { canManageUsers } from "@/lib/permissions";

/** Reopens a FINALIZED payslip back to DRAFT so it can be corrected. Does not undo
 * a previously sent email -- if the numbers change, re-finalize to send a corrected one. */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  let session;
  try {
    session = requireSession(request);
  } catch (e) {
    if (e instanceof SessionError) return NextResponse.json({ error: e.message }, { status: 401 });
    throw e;
  }
  if (!(await canManageUsers(session.tenantId, session.roleId))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const payslip = await prisma.payslip.findFirst({ where: { id, tenantId: session.tenantId } });
  if (!payslip) return NextResponse.json({ error: "Payslip not found" }, { status: 404 });
  if (payslip.status !== "FINALIZED") return NextResponse.json({ error: "This payslip isn't finalized" }, { status: 400 });

  const updated = await prisma.payslip.update({
    where: { id },
    data: { status: "DRAFT", finalizedAt: null, finalizedById: null },
  });
  return NextResponse.json(updated);
}
