import puppeteer from "puppeteer";
import { puppeteerLaunchOptions } from "@/lib/puppeteer-launch-options";

export async function generateInvoicePdf(origin: string): Promise<Buffer> {
  const browser = await puppeteer.launch(puppeteerLaunchOptions);
  try {
    const page = await browser.newPage();
    await page.goto(`${origin}/invoice/print`, { waitUntil: "networkidle0" });
    const pdfBuffer = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "10mm", bottom: "10mm", left: "8mm", right: "8mm" },
    });
    return Buffer.from(pdfBuffer);
  } finally {
    await browser.close();
  }
}
