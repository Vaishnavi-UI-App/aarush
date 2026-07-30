import { NextRequest, NextResponse } from "next/server";
import { requireSession, SessionError, SESSION_COOKIE_NAME } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { generateRealInvoicePdf } from "@/lib/generate-real-invoice-pdf";

const GRAPH_VERSION = "v20.0";

/** Sends an invoice PDF via the WhatsApp Business Cloud API from the tenant's registered
 * business number. Requires WHATSAPP_PHONE_NUMBER_ID and WHATSAPP_ACCESS_TOKEN (Meta
 * WhatsApp Business Platform credentials for that number) -- without them this 500s so
 * the caller can fall back to a wa.me deep link instead. */
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

  const invoice = await prisma.invoice.findFirst({
    where: { id, tenantId: session.tenantId },
    include: { customer: true },
  });
  if (!invoice) {
    return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
  }

  const to = (body.to as string | undefined) || invoice.customer.phone?.replace(/\D/g, "");
  if (!to) {
    return NextResponse.json({ error: "No phone number provided and none on file for this customer" }, { status: 400 });
  }

  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
  if (!phoneNumberId || !accessToken) {
    return NextResponse.json(
      { error: "WhatsApp Business API is not configured. Set WHATSAPP_PHONE_NUMBER_ID and WHATSAPP_ACCESS_TOKEN in .env." },
      { status: 500 }
    );
  }

  try {
    const pdfBuffer = await generateRealInvoicePdf(
      request.nextUrl.origin,
      request.cookies.get(SESSION_COOKIE_NAME)?.value,
      id
    );

    const docLabel = invoice.type === "PROFORMA" ? "Proforma Invoice" : "Tax Invoice";
    const filename = `${invoice.number.replace(/\//g, "-")}.pdf`;

    const form = new FormData();
    form.append("messaging_product", "whatsapp");
    form.append("file", new Blob([new Uint8Array(pdfBuffer)], { type: "application/pdf" }), filename);
    form.append("type", "application/pdf");

    const uploadRes = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${phoneNumberId}/media`, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}` },
      body: form,
    });
    const uploadData = await uploadRes.json();
    if (!uploadRes.ok) {
      return NextResponse.json({ error: uploadData.error?.message ?? "Media upload failed" }, { status: 502 });
    }

    const sendRes = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${phoneNumberId}/messages`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to,
        type: "document",
        document: {
          id: uploadData.id,
          filename,
          caption: `${docLabel} ${invoice.number} - Rs. ${Number(invoice.total).toFixed(2)}`,
        },
      }),
    });
    const sendData = await sendRes.json();
    if (!sendRes.ok) {
      return NextResponse.json({ error: sendData.error?.message ?? "Message send failed" }, { status: 502 });
    }

    return NextResponse.json({ success: true, messageId: sendData.messages?.[0]?.id });
  } catch (e) {
    console.error("Failed to send invoice via WhatsApp:", e);
    return NextResponse.json({ error: e instanceof Error ? e.message : "Failed to send WhatsApp message" }, { status: 500 });
  }
}
