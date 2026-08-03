import { NextResponse } from "next/server";
import { generateInvoicePdf } from "@/lib/generate-invoice-pdf";
import { INTERNAL_ORIGIN } from "@/lib/internal-origin";

export async function GET() {
  const pdfBuffer = await generateInvoicePdf(INTERNAL_ORIGIN);

  return new NextResponse(new Uint8Array(pdfBuffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": "inline; filename=invoice.pdf",
    },
  });
}
