/** Builds the small HTML snippet Puppeteer's page.pdf({ headerTemplate }) repeats at the
 * top of every page of a generated PDF.
 *
 * We tried getting this "for free" via the document's own <thead> (display:
 * table-header-group is supposed to repeat across print page breaks per the CSS
 * spec) -- verified against a real 4-page invoice and it doesn't reliably repeat in
 * Chromium's print-to-PDF pipeline once the header content is more than a couple of
 * plain <th> cells (nested tables inside the header row broke it entirely, and even
 * the plain column-header row stopped repeating). Puppeteer's headerTemplate is a
 * completely separate mechanism (an isolated mini-page Chromium renders once per
 * physical page) and it demonstrably does repeat -- the "Page X of Y" footer already
 * relies on it. So a compact identification strip goes through this instead.
 */
function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export function buildRepeatingHeaderTemplate(opts: { logoSrc: string; companyName: string; docLabel: string; partyName: string }): string {
  const logo = opts.logoSrc
    ? `<img src="${escapeHtml(opts.logoSrc)}" style="width:14px;height:14px;object-fit:contain;margin-right:5px;" />`
    : "";
  return `
    <div style="width:100%;font-size:8.5px;padding:0 8mm;display:flex;align-items:center;color:#444;font-family:Arial,Helvetica,sans-serif;border-bottom:1px solid #ccc;padding-bottom:3px;">
      ${logo}
      <span style="font-weight:bold;">${escapeHtml(opts.companyName)}</span>
      <span style="margin-left:auto;">${escapeHtml(opts.docLabel)} &nbsp;&middot;&nbsp; ${escapeHtml(opts.partyName)}</span>
    </div>
  `;
}
