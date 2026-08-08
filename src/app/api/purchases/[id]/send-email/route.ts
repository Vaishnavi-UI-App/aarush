import { NextRequest, NextResponse } from "next/server";
import { requireSession, SessionError, SESSION_COOKIE_NAME } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { generatePurchasePdf } from "@/lib/generate-purchase-pdf";
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

  const [purchase, tenant] = await Promise.all([
    prisma.purchase.findFirst({ where: { id, tenantId: session.tenantId }, include: { vendor: true } }),
    prisma.tenant.findUniqueOrThrow({ where: { id: session.tenantId } }),
  ]);
  if (!purchase) {
    return NextResponse.json({ error: "Purchase bill not found" }, { status: 404 });
  }

  const to = body.to || purchase.vendor.email;
  if (!to) {
    return NextResponse.json({ error: "No email address provided and none on file for this vendor" }, { status: 400 });
  }

  try {
    const pdfBuffer = await generatePurchasePdf(INTERNAL_ORIGIN, request.cookies.get(SESSION_COOKIE_NAME)?.value, id);

    await sendMail({
      to,
      subject: `Purchase Bill ${purchase.number} from ${tenant.name}`,
      text: `Dear ${purchase.vendor.name},\n\nPlease find attached purchase bill ${purchase.number} for Rs. ${Number(purchase.total).toFixed(2)}, recorded against goods/services received.\n\n${tenant.name}`,
      attachments: [
        {
          filename: `${purchase.number.replace(/\//g, "-")}.pdf`,
          content: pdfBuffer,
        },
      ],
    });
  } catch (e) {
    console.error("Failed to email purchase bill:", e);
    return NextResponse.json({ error: e instanceof Error ? e.message : "Failed to send email" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
