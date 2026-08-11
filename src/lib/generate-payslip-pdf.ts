import puppeteer from "puppeteer";
import { SESSION_COOKIE_NAME } from "@/lib/session";
import { puppeteerLaunchOptions } from "@/lib/puppeteer-launch-options";

/** Renders a real, persisted payslip's print view (/print/payslips/[id]) to PDF. That
 * route is session-gated like everywhere else, so the caller's session token must be
 * forwarded explicitly -- Puppeteer's browser context starts cookieless. */
export async function generatePayslipPdf(origin: string, sessionToken: string | undefined, payslipId: string): Promise<Buffer> {
  const url = new URL(`/print/payslips/${payslipId}`, origin);

  const browser = await puppeteer.launch(puppeteerLaunchOptions);
  try {
    const page = await browser.newPage();

    if (sessionToken) {
      await page.setCookie({ name: SESSION_COOKIE_NAME, value: sessionToken, url: origin });
    }

    const response = await page.goto(url.toString(), { waitUntil: "networkidle0" });
    if (!response || response.status() === 404) {
      throw new Error("Payslip not found");
    }

    const pdfBuffer = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "12mm", bottom: "12mm", left: "10mm", right: "10mm" },
    });

    return Buffer.from(pdfBuffer);
  } finally {
    await browser.close();
  }
}
