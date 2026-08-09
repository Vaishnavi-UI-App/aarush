import puppeteer from "puppeteer";
import { SESSION_COOKIE_NAME } from "@/lib/session";
import { puppeteerLaunchOptions } from "@/lib/puppeteer-launch-options";
import { buildRepeatingHeaderTemplate } from "@/lib/pdf-repeating-header";

/** Renders a real, persisted delivery challan's print view (/print/delivery-challans/[id])
 * to PDF. That route is session-gated like everywhere else, so the caller's session token
 * must be forwarded explicitly -- Puppeteer's browser context starts cookieless. */
export async function generateDeliveryChallanPdf(
  origin: string,
  sessionToken: string | undefined,
  challanId: string
): Promise<Buffer> {
  const url = new URL(`/print/delivery-challans/${challanId}`, origin);

  const browser = await puppeteer.launch(puppeteerLaunchOptions);
  try {
    const page = await browser.newPage();

    if (sessionToken) {
      await page.setCookie({ name: SESSION_COOKIE_NAME, value: sessionToken, url: origin });
    }

    const response = await page.goto(url.toString(), { waitUntil: "networkidle0" });
    if (!response || response.status() === 404) {
      throw new Error("Delivery challan not found");
    }

    const headerInfo = await page.evaluate(() => ({
      logoSrc: (document.querySelector<HTMLImageElement>(".dc-logo"))?.src ?? "",
      companyName: document.querySelector(".dc-company-name")?.textContent?.trim() ?? "",
      docLabel: document.querySelector(".dc-title")?.textContent?.trim() ?? "",
      partyName: document.querySelector(".dc-to-value")?.textContent?.trim() ?? "",
    }));

    const pdfBuffer = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "16mm", bottom: "14mm", left: "8mm", right: "8mm" },
      displayHeaderFooter: true,
      headerTemplate: buildRepeatingHeaderTemplate({
        logoSrc: headerInfo.logoSrc,
        companyName: headerInfo.companyName,
        docLabel: headerInfo.docLabel,
        partyName: headerInfo.partyName,
      }),
      footerTemplate:
        '<div style="width:100%;font-size:9px;text-align:center;color:#555;font-family:Arial,Helvetica,sans-serif;">Page <span class="pageNumber"></span> of <span class="totalPages"></span></div>',
    });

    return Buffer.from(pdfBuffer);
  } finally {
    await browser.close();
  }
}
