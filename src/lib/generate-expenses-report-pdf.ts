import puppeteer from "puppeteer";
import { SESSION_COOKIE_NAME } from "@/lib/session";
import { puppeteerLaunchOptions } from "@/lib/puppeteer-launch-options";

/** Renders the filtered expense report (/print/expenses) to PDF. Same pattern as
 * generateRealInvoicePdf -- that route is session-gated, so the caller's session token
 * must be forwarded explicitly since Puppeteer's browser context starts cookieless. */
export async function generateExpensesReportPdf(
  origin: string,
  sessionToken: string | undefined,
  filters: { siteId?: string; from?: string; to?: string }
): Promise<Buffer> {
  const url = new URL("/print/expenses", origin);
  if (filters.siteId) url.searchParams.set("siteId", filters.siteId);
  if (filters.from) url.searchParams.set("from", filters.from);
  if (filters.to) url.searchParams.set("to", filters.to);

  const browser = await puppeteer.launch(puppeteerLaunchOptions);
  try {
    const page = await browser.newPage();

    if (sessionToken) {
      await page.setCookie({ name: SESSION_COOKIE_NAME, value: sessionToken, url: origin });
    }

    const response = await page.goto(url.toString(), { waitUntil: "networkidle0" });
    if (!response || response.status() === 404) {
      throw new Error("Could not generate the report");
    }

    const pdfBuffer = await page.pdf({
      format: "A4",
      landscape: true,
      printBackground: true,
      margin: { top: "10mm", bottom: "10mm", left: "8mm", right: "8mm" },
    });

    return Buffer.from(pdfBuffer);
  } finally {
    await browser.close();
  }
}
