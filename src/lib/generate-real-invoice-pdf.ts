import puppeteer from "puppeteer";
import { SESSION_COOKIE_NAME } from "@/lib/session";
import { puppeteerLaunchOptions } from "@/lib/puppeteer-launch-options";

/** Renders a real, persisted invoice's print view (/print/invoices/[id]) to PDF.
 * That route is session-gated like everywhere else, so the caller's session token
 * must be forwarded explicitly -- Puppeteer's browser context starts cookieless. */
export async function generateRealInvoicePdf(
  origin: string,
  sessionToken: string | undefined,
  invoiceId: string
): Promise<Buffer> {
  const url = new URL(`/print/invoices/${invoiceId}`, origin);

  const browser = await puppeteer.launch(puppeteerLaunchOptions);
  try {
    const page = await browser.newPage();

    if (sessionToken) {
      await page.setCookie({ name: SESSION_COOKIE_NAME, value: sessionToken, url: origin });
    }

    const response = await page.goto(url.toString(), { waitUntil: "networkidle0" });
    if (!response || response.status() === 404) {
      throw new Error("Invoice not found");
    }

    const pdfBuffer = await page.pdf({
      format: "A4",
      landscape: true,
      printBackground: true,
      margin: { top: "10mm", bottom: "14mm", left: "8mm", right: "8mm" },
      displayHeaderFooter: true,
      headerTemplate: "<span/>",
      footerTemplate:
        '<div style="width:100%;font-size:9px;text-align:center;color:#555;font-family:Arial,Helvetica,sans-serif;">Page <span class="pageNumber"></span> of <span class="totalPages"></span></div>',
    });

    return Buffer.from(pdfBuffer);
  } finally {
    await browser.close();
  }
}
