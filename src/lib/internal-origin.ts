/** Origin for server-to-self requests (Puppeteer rendering /print pages, etc.) -- always
 * the app's own loopback address, never request.nextUrl.origin. The latter reflects
 * whatever Host/X-Forwarded-Proto a reverse proxy passes through, which can resolve to
 * something unreachable from inside the container (e.g. "https://localhost:3000", which
 * has no TLS listener) depending on proxy config. Chromium treats "localhost" as a secure
 * context regardless of scheme, so Secure-flagged session cookies still work here. */
export const INTERNAL_ORIGIN = `http://localhost:${process.env.PORT ?? 3000}`;
