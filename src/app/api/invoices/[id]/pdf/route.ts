import { NextRequest, NextResponse } from "next/server";
import { requireSession, SessionError, SESSION_COOKIE_NAME } from "@/lib/session";
import { generateRealInvoicePdf } from "@/lib/generate-real-invoice-pdf";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  let session;
  try {
    session = requireSession(request);
  } catch (e) {
    if (e instanceof SessionError) return NextResponse.json({ error: e.message }, { status: 401 });
    throw e;
  }

  const { id } = await params;
  const sessionToken = request.cookies.get(SESSION_COOKIE_NAME)?.value;

  try {
    const [pdfBuffer, invoice] = await Promise.all([
      generateRealInvoicePdf(request.nextUrl.origin, sessionToken, id),
      prisma.invoice.findFirst({ where: { id, tenantId: session.tenantId }, select: { number: true } }),
    ]);
    const filename = invoice ? `${invoice.number.replace(/\//g, "-")}.pdf` : `invoice-${id}.pdf`;
    return new NextResponse(new Uint8Array(pdfBuffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch {
    return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
  }
}
