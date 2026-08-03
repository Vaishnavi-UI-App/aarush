import { NextRequest, NextResponse } from "next/server";
import { requireSession, SessionError, SESSION_COOKIE_NAME } from "@/lib/session";
import { generateDeliveryChallanPdf } from "@/lib/generate-delivery-challan-pdf";
import { INTERNAL_ORIGIN } from "@/lib/internal-origin";
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
    const [pdfBuffer, challan] = await Promise.all([
      generateDeliveryChallanPdf(INTERNAL_ORIGIN, sessionToken, id),
      prisma.deliveryChallan.findFirst({ where: { id, tenantId: session.tenantId }, select: { number: true } }),
    ]);
    const filename = challan ? `${challan.number.replace(/\//g, "-")}.pdf` : `delivery-challan-${id}.pdf`;
    return new NextResponse(new Uint8Array(pdfBuffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch {
    return NextResponse.json({ error: "Delivery challan not found" }, { status: 404 });
  }
}
