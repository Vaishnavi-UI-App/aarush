import { NextRequest, NextResponse } from "next/server";
import { generateInvoicePdf } from "@/lib/generate-invoice-pdf";
import { sampleInvoice } from "@/lib/invoice-data";
import { sendMail } from "@/lib/mailer";

export async function POST(request: NextRequest) {
  const { to } = await request.json();

  if (!to || typeof to !== "string") {
    return NextResponse.json({ error: "Recipient email 'to' is required" }, { status: 400 });
  }

  const pdfBuffer = await generateInvoicePdf(request.nextUrl.origin);

  try {
    await sendMail({
      to,
      subject: `Tax Invoice ${sampleInvoice.invoiceNumber} from ${sampleInvoice.seller.name}`,
      text: `Dear ${sampleInvoice.billedTo.name},\n\nPlease find attached your tax invoice ${sampleInvoice.invoiceNumber} dated ${sampleInvoice.invoiceDate} for Rs. ${sampleInvoice.grandTotal.toFixed(2)}.\n\nThank you for your business.\n\n${sampleInvoice.seller.name}`,
      attachments: [
        {
          filename: `${sampleInvoice.invoiceNumber.replace(/\//g, "-")}.pdf`,
          content: pdfBuffer,
        },
      ],
    });
  } catch (e) {
    console.error("Failed to send invoice email:", e);
    return NextResponse.json({ error: e instanceof Error ? e.message : "Failed to send email" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
