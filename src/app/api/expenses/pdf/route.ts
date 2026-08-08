import { NextRequest, NextResponse } from "next/server";
import { requireSession, SessionError, SESSION_COOKIE_NAME } from "@/lib/session";
import { generateExpensesReportPdf } from "@/lib/generate-expenses-report-pdf";
import { INTERNAL_ORIGIN } from "@/lib/internal-origin";

export async function GET(request: NextRequest) {
  try {
    requireSession(request);
  } catch (e) {
    if (e instanceof SessionError) return NextResponse.json({ error: e.message }, { status: 401 });
    throw e;
  }

  const params = request.nextUrl.searchParams;
  const sessionToken = request.cookies.get(SESSION_COOKIE_NAME)?.value;

  try {
    const pdfBuffer = await generateExpensesReportPdf(INTERNAL_ORIGIN, sessionToken, {
      siteId: params.get("siteId") || undefined,
      from: params.get("from") || undefined,
      to: params.get("to") || undefined,
    });
    return new NextResponse(new Uint8Array(pdfBuffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="expenses-report-${new Date().toISOString().slice(0, 10)}.pdf"`,
      },
    });
  } catch {
    return NextResponse.json({ error: "Could not generate the report" }, { status: 500 });
  }
}
