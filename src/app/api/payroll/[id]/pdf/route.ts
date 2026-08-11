import { NextRequest, NextResponse } from "next/server";
import { requireSession, SessionError, SESSION_COOKIE_NAME } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { canManageUsers } from "@/lib/permissions";
import { generatePayslipPdf } from "@/lib/generate-payslip-pdf";
import { INTERNAL_ORIGIN } from "@/lib/internal-origin";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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

  const pdfBuffer = await generatePayslipPdf(INTERNAL_ORIGIN, request.cookies.get(SESSION_COOKIE_NAME)?.value, id);

  return new NextResponse(new Uint8Array(pdfBuffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="Payslip-${payslip.year}-${payslip.month}.pdf"`,
      "Content-Length": String(pdfBuffer.length),
    },
  });
}
