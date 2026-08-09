import puppeteer from "puppeteer";
import { puppeteerLaunchOptions } from "@/lib/puppeteer-launch-options";
import { buildRepeatingHeaderTemplate } from "@/lib/pdf-repeating-header";

export async function generateInvoicePdf(origin: string): Promise<Buffer> {
  const browser = await puppeteer.launch(puppeteerLaunchOptions);
  try {
    const page = await browser.newPage();
    await page.goto(`${origin}/invoice/print`, { waitUntil: "networkidle0" });

    const headerInfo = await page.evaluate(() => ({
      logoSrc: (document.querySelector<HTMLImageElement>(".logo-img"))?.src ?? "",
      companyName: document.querySelector(".seller-name")?.textContent?.trim() ?? "",
      docLabel: document.querySelector(".title-row")?.textContent?.trim() ?? "",
      partyName: (document.querySelector(".party-cell b")?.textContent ?? "").replace(/^Name:\s*/, "").trim(),
    }));

    const pdfBuffer = await page.pdf({
      format: "A4",
      printBackground: true,
      // Portrait + scale, not landscape -- see generate-real-invoice-pdf.ts for why.
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
