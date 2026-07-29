import { NextRequest, NextResponse } from "next/server";
import { requireSession, SessionError } from "@/lib/session";
import { convertProformaToSale } from "@/lib/gst-invoice";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  let session;
  try {
    session = requireSession(request);
  } catch (e) {
    if (e instanceof SessionError) return NextResponse.json({ error: e.message }, { status: 401 });
    throw e;
  }

  const { id } = await params;

  try {
    const invoice = await convertProformaToSale(session.tenantId, id);
    return NextResponse.json(invoice, { status: 201 });
  } catch (e) {
    console.error("Failed to convert proforma:", e);
    const message = e instanceof Error ? e.message : "Could not convert proforma invoice";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
