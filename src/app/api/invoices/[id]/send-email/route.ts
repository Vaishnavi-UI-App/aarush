import { NextRequest, NextResponse } from "next/server";
import { requireSession, SessionError, SESSION_COOKIE_NAME } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { generateRealInvoicePdf } from "@/lib/generate-real-invoice-pdf";
import { INTERNAL_ORIGIN } from "@/lib/internal-origin";
import { sendMail } from "@/lib/mailer";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  let session;
  try {
    session = requireSession(request);
  } catch (e) {
    if (e instanceof SessionError) return NextResponse.json({ error: e.message }, { status: 401 });
    throw e;
  }

  const { id } = await params;
  const body = await request.json().catch(() => ({}));

  const [invoice, tenant] = await Promise.all([
    prisma.invoice.findFirst({ where: { id, tenantId: session.tenantId }, include: { customer: true } }),
    prisma.tenant.findUniqueOrThrow({ where: { id: session.tenantId } }),
  ]);
  if (!invoice) {
    return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
  }

  const to = body.to || invoice.customer.email;
  if (!to) {
    return NextResponse.json({ error: "No email address provided and none on file for this customer" }, { status: 400 });
  }

  try {
    const pdfBuffer = await generateRealInvoicePdf(
      INTERNAL_ORIGIN,
      request.cookies.get(SESSION_COOKIE_NAME)?.value,
      id
    );

    const docLabel =
      invoice.type === "PROFORMA"
        ? "Proforma Invoice"
        : invoice.type === "QUOTATION"
          ? "Quotation"
          : invoice.isServiceInvoice
            ? "Service Tax Invoice"
            : "Tax Invoice";
    await sendMail({
      to,
      subject: `${docLabel} ${invoice.number} from ${tenant.name}`,
      text: `Dear ${invoice.customer.name},\n\nPlease find attached ${docLabel.toLowerCase()} ${invoice.number} for Rs. ${Number(invoice.total).toFixed(2)}.\n\nThank you for your business.\n\n${tenant.name}`,
      attachments: [
        {
          filename: `${invoice.number.replace(/\//g, "-")}.pdf`,
          content: pdfBuffer,
        },
      ],
    });
  } catch (e) {
    console.error("Failed to email invoice:", e);
    return NextResponse.json({ error: e instanceof Error ? e.message : "Failed to send email" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
