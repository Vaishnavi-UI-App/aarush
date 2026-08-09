import puppeteer from "puppeteer";
import { SESSION_COOKIE_NAME } from "@/lib/session";
import { puppeteerLaunchOptions } from "@/lib/puppeteer-launch-options";
import { buildRepeatingHeaderTemplate } from "@/lib/pdf-repeating-header";

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

    const headerInfo = await page.evaluate(() => ({
      logoSrc: (document.querySelector<HTMLImageElement>(".logo-img"))?.src ?? "",
      companyName: document.querySelector(".seller-name")?.textContent?.trim() ?? "",
      docLabel: document.querySelector(".title-row")?.textContent?.trim() ?? "",
      partyName: (document.querySelector(".party-cell b")?.textContent ?? "").replace(/^Name:\s*/, "").trim(),
    }));

    const pdfBuffer = await page.pdf({
      format: "A4",
      printBackground: true,
      // Portrait, not landscape -- landscape "fixed" the wide GST column grid getting
      // cut off on the right, but it did that by trading page height for width, which
      // then made short invoices spill their Bank Details/Terms block onto an
      // otherwise-empty second page. Scaling down instead fixes both at once: it
      // shrinks the ~900px-wide document to fit portrait's ~733px usable width, and
      // since height shrinks by the same factor, a one-item invoice now has plenty of
      // room to spare rather than needing every trimmed-padding trick to just barely fit.
      scale: 0.8,
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
