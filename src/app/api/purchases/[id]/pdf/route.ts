import { NextRequest, NextResponse } from "next/server";
import puppeteer from "puppeteer";
import { requireSession, SessionError, SESSION_COOKIE_NAME } from "@/lib/session";
import { puppeteerLaunchOptions } from "@/lib/puppeteer-launch-options";
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
  const origin = request.nextUrl.origin;
  const url = new URL(`/print/purchases/${id}`, origin);
  const purchase = await prisma.purchase.findFirst({ where: { id, tenantId: session.tenantId }, select: { number: true } });

  const browser = await puppeteer.launch(puppeteerLaunchOptions);
  try {
    const page = await browser.newPage();
    if (sessionToken) {
      await page.setCookie({ name: SESSION_COOKIE_NAME, value: sessionToken, url: origin });
    }

    const response = await page.goto(url.toString(), { waitUntil: "networkidle0" });
    if (!response || response.status() === 404) {
      return NextResponse.json({ error: "Purchase bill not found" }, { status: 404 });
    }

    const pdfBuffer = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "10mm", bottom: "10mm", left: "8mm", right: "8mm" },
    });

    const filename = purchase ? `${purchase.number.replace(/\//g, "-")}.pdf` : `purchase-${id}.pdf`;
    return new NextResponse(new Uint8Array(pdfBuffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } finally {
    await browser.close();
  }
}
