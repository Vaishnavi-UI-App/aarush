import { NextRequest, NextResponse } from "next/server";
import { generateInvoicePdf } from "@/lib/generate-invoice-pdf";

export async function GET(request: NextRequest) {
  const pdfBuffer = await generateInvoicePdf(request.nextUrl.origin);

  return new NextResponse(new Uint8Array(pdfBuffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": "inline; filename=invoice.pdf",
    },
  });
}
