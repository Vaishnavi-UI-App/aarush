import { NextRequest, NextResponse } from "next/server";
import { generateInvoicePdf } from "@/lib/generate-invoice-pdf";
import { INTERNAL_ORIGIN } from "@/lib/internal-origin";
import { sampleInvoice } from "@/lib/invoice-data";

const GRAPH_VERSION = "v20.0";

export async function POST(request: NextRequest) {
  const { to } = await request.json();

  if (!to || typeof to !== "string") {
    return NextResponse.json({ error: "Recipient WhatsApp number 'to' is required (E.164, e.g. 919545519101)" }, { status: 400 });
  }

  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;

  if (!phoneNumberId || !accessToken) {
    return NextResponse.json(
      { error: "WhatsApp is not configured. Set WHATSAPP_PHONE_NUMBER_ID and WHATSAPP_ACCESS_TOKEN in .env.local" },
      { status: 500 }
    );
  }

  const pdfBuffer = await generateInvoicePdf(INTERNAL_ORIGIN);
  const filename = `${sampleInvoice.invoiceNumber.replace(/\//g, "-")}.pdf`;

  const form = new FormData();
  form.append("messaging_product", "whatsapp");
  form.append("file", new Blob([new Uint8Array(pdfBuffer)], { type: "application/pdf" }), filename);
  form.append("type", "application/pdf");

  const uploadRes = await fetch(
    `https://graph.facebook.com/${GRAPH_VERSION}/${phoneNumberId}/media`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}` },
      body: form,
    }
  );
  const uploadData = await uploadRes.json();

  if (!uploadRes.ok) {
    return NextResponse.json({ error: uploadData.error?.message ?? "Media upload failed" }, { status: 500 });
  }

  const sendRes = await fetch(
    `https://graph.facebook.com/${GRAPH_VERSION}/${phoneNumberId}/messages`,
    {
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
          caption: `Tax Invoice ${sampleInvoice.invoiceNumber} - Rs. ${sampleInvoice.grandTotal.toFixed(2)}`,
        },
      }),
    }
  );
  const sendData = await sendRes.json();

  if (!sendRes.ok) {
    return NextResponse.json({ error: sendData.error?.message ?? "Message send failed" }, { status: 500 });
  }

  return NextResponse.json({ success: true, messageId: sendData.messages?.[0]?.id });
}
