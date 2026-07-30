import { LaunchOptions } from "puppeteer";

/** In Docker/VPS we install system Chromium and point PUPPETEER_EXECUTABLE_PATH at it
 * (see Dockerfile) instead of bundling Puppeteer's own download -- smaller image, no
 * download step at build time. Locally this env var is unset, so Puppeteer falls back
 * to the Chromium it downloaded during `npm install`. */
export const puppeteerLaunchOptions: LaunchOptions = {
  headless: true,
  executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
  args: process.env.PUPPETEER_EXECUTABLE_PATH ? ["--no-sandbox", "--disable-setuid-sandbox"] : [],
};
