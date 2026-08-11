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

/** Finalizes and emails several payslips in one action -- same rules as the single
 * finalize endpoint, just looped, so one slow/failing email doesn't block the rest. */
export async function POST(request: NextRequest) {
  let session;
  try {
    session = requireSession(request);
  } catch (e) {
    if (e instanceof SessionError) return NextResponse.json({ error: e.message }, { status: 401 });
    throw e;
  }
  if (!(await canManageUsers(session.tenantId, session.roleId))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await request.json().catch(() => ({}));
  const ids: string[] = Array.isArray(body.ids) ? body.ids.filter((x: unknown) => typeof x === "string") : [];
  if (ids.length === 0) return NextResponse.json({ error: "ids[] is required" }, { status: 400 });

  const sessionToken = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const results: { id: string; ok: boolean; error?: string; emailed?: boolean }[] = [];

  for (const id of ids) {
    try {
      const payslip = await prisma.payslip.findFirst({
        where: { id, tenantId: session.tenantId },
        include: { user: { select: { name: true, email: true } } },
      });
      if (!payslip) {
        results.push({ id, ok: false, error: "Not found" });
        continue;
      }
      if (payslip.status === "FINALIZED") {
        results.push({ id, ok: false, error: "Already finalized" });
        continue;
      }

      const finalized = await prisma.payslip.update({
        where: { id },
        data: { status: "FINALIZED", finalizedAt: new Date(), finalizedById: session.userId },
        include: { user: { select: { name: true, email: true } } },
      });

      let emailed = false;
      try {
        const pdfBuffer = await generatePayslipPdf(INTERNAL_ORIGIN, sessionToken, id);
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
        console.error(`Payslip ${id} finalized but emailing failed:`, e);
      }

      results.push({ id, ok: true, emailed });
    } catch (e) {
      results.push({ id, ok: false, error: e instanceof Error ? e.message : "Failed" });
    }
  }

  return NextResponse.json({ results });
}
