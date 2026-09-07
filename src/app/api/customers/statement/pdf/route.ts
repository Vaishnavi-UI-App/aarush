import { NextRequest, NextResponse } from "next/server";
import { requireSession, SessionError, SESSION_COOKIE_NAME } from "@/lib/session";
import { generateAllCustomersStatementPdf } from "@/lib/generate-all-customers-statement-pdf";
import { INTERNAL_ORIGIN } from "@/lib/internal-origin";

export async function GET(request: NextRequest) {
  try {
    requireSession(request);
  } catch (e) {
    if (e instanceof SessionError) return NextResponse.json({ error: e.message }, { status: 401 });
    throw e;
  }

  const sessionToken = request.cookies.get(SESSION_COOKIE_NAME)?.value;

  try {
    const pdfBuffer = await generateAllCustomersStatementPdf(INTERNAL_ORIGIN, sessionToken);
    return new NextResponse(new Uint8Array(pdfBuffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="all-customers-statement.pdf"`,
      },
    });
  } catch {
    return NextResponse.json({ error: "Could not generate statement" }, { status: 500 });
  }
}
