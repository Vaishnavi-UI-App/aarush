import { NextRequest, NextResponse } from "next/server";
import { requireSession, SessionError, SESSION_COOKIE_NAME } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { canManageUsers } from "@/lib/permissions";
import { generatePayslipPdf } from "@/lib/generate-payslip-pdf";
import { INTERNAL_ORIGIN } from "@/lib/internal-origin";
import { sendMail } from "@/lib/mailer";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/** Finalizes one payslip and emails the PDF to the employee's registered address.
 * Finalizing locks it against further edits (see PATCH /api/payroll/[id]) until an
 * admin explicitly reopens it. Emailing failure doesn't undo the finalization -- the
 * numbers are final either way, the admin can just retry sending separately. */
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
  const payslip = await prisma.payslip.findFirst({
    where: { id, tenantId: session.tenantId },
    include: { user: { select: { name: true, email: true } } },
  });
  if (!payslip) return NextResponse.json({ error: "Payslip not found" }, { status: 404 });
  if (payslip.status === "FINALIZED") return NextResponse.json({ error: "Already finalized" }, { status: 400 });

  const finalized = await prisma.payslip.update({
    where: { id },
    data: { status: "FINALIZED", finalizedAt: new Date(), finalizedById: session.userId },
    include: { user: { select: { name: true, email: true } } },
  });

  let emailed = false;
  let emailError: string | null = null;
  try {
    const pdfBuffer = await generatePayslipPdf(INTERNAL_ORIGIN, request.cookies.get(SESSION_COOKIE_NAME)?.value, id);
    const monthLabel = `${MONTH_NAMES[finalized.month - 1]} ${finalized.year}`;
    await sendMail({
      to: finalized.user.email,
      subject: `Payslip for ${monthLabel}`,
      text: `Dear ${finalized.user.name || finalized.user.email},\n\nYour payslip for ${monthLabel} is attached.\n\nNet Payable: Rs. ${Number(finalized.netPayable).toFixed(2)}\n\nThis is a computer-generated payslip and does not require a signature.`,
      attachments: [{ filename: `Payslip-${monthLabel.replace(" ", "-")}.pdf`, content: pdfBuffer }],
    });
    emailed = true;
    await prisma.payslip.update({ where: { id }, data: { emailedAt: new Date() } });
  } catch (e) {
    console.error("Payslip finalized but emailing failed:", e);
    emailError = e instanceof Error ? e.message : "Failed to email the payslip";
  }

  return NextResponse.json({ ...finalized, emailed, emailError });
}
