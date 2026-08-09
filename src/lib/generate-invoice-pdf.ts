import puppeteer from "puppeteer";
import { puppeteerLaunchOptions } from "@/lib/puppeteer-launch-options";

export async function generateInvoicePdf(origin: string): Promise<Buffer> {
  const browser = await puppeteer.launch(puppeteerLaunchOptions);
  try {
    const page = await browser.newPage();
    await page.goto(`${origin}/invoice/print`, { waitUntil: "networkidle0" });
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
