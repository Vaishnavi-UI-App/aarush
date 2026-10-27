import { round2 } from "@/lib/gst-invoice";
import { normalizeStateCode } from "@/lib/state-codes";
import {
  B2bRow,
  B2clRow,
  B2csRow,
  DocsSummary,
  Gstr1Invoice,
  HsnRow,
  RateRow,
} from "@/lib/gstr1";

/** The GST offline tool rejects anything much larger, and the portal's own limit is 5MB
 * -- staying under 3MB leaves room for the hash and version fields it adds on upload. */
export const MAX_JSON_BYTES = 3 * 1024 * 1024;

/** Schema version the offline tool currently expects in the envelope. */
const GST_VERSION = "GST3.2.2";

/** Portal dates are DD-MM-YYYY, read in UTC for the same reason the Excel export is:
 * invoice dates are stored as UTC midnights. */
function portalDate(d: Date): string {
  const dd = String(d.getUTCDate()).padStart(2, "0");
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${dd}-${mm}-${d.getUTCFullYear()}`;
}

/** Filing period, MMYYYY. */
export function filingPeriod(d: Date): string {
  return `${String(d.getUTCMonth() + 1).padStart(2, "0")}${d.getUTCFullYear()}`;
}

/** The portal wants one item entry per tax rate, numbered from 1 within its invoice. */
function items(rows: RateRow[]) {
  return rows.map((r, i) => ({
    num: i + 1,
    itm_det: {
      rt: r.rate,
      txval: r.taxableValue,
      iamt: r.igst,
      camt: r.cgst,
      samt: r.sgst,
      csamt: r.cess,
    },
  }));
}

/** Groups the flat per-rate rows back into the portal's invoice-then-items shape. */
function groupByInvoice<T extends { invoiceNumber: string; invoiceDate: Date; invoiceValue: number }>(rows: T[]) {
  const byNumber = new Map<string, { head: T; rates: RateRow[] }>();
  for (const r of rows) {
    const existing = byNumber.get(r.invoiceNumber);
    const rate = r as unknown as RateRow;
    if (existing) existing.rates.push(rate);
    else byNumber.set(r.invoiceNumber, { head: r, rates: [rate] });
  }
  return [...byNumber.values()];
}

export interface Gstr1JsonInput {
  companyGstin: string;
  /** Every selected invoice, cancelled ones included -- they belong in doc_issue. */
  issued: Gstr1Invoice[];
  /** Issued less cancelled: what the tax sections report. */
  live: Gstr1Invoice[];
  b2b: B2bRow[];
  b2cl: B2clRow[];
  b2cs: B2csRow[];
  hsn: HsnRow[];
  docs: DocsSummary;
}

export function buildGstr1Json(input: Gstr1JsonInput): Record<string, unknown> {
  const { companyGstin, issued, b2b, b2cl, b2cs, hsn, docs } = input;

  // b2b is grouped by the buyer's GSTIN, then by invoice beneath it.
  const b2bByCtin = new Map<string, typeof b2b>();
  for (const r of b2b) {
    if (!b2bByCtin.has(r.gstin)) b2bByCtin.set(r.gstin, []);
    b2bByCtin.get(r.gstin)!.push(r);
  }

  const json: Record<string, unknown> = {
    gstin: companyGstin,
    fp: filingPeriod(issued[0].date),
    version: GST_VERSION,
    hash: "hash",
  };

  if (b2bByCtin.size > 0) {
    json.b2b = [...b2bByCtin.entries()].map(([ctin, rows]) => ({
      ctin,
      inv: groupByInvoice(rows).map(({ head, rates }) => ({
        inum: head.invoiceNumber,
        idt: portalDate(head.invoiceDate),
        val: head.invoiceValue,
        pos: normalizeStateCode(head.placeOfSupply.split("-")[0]),
        rchrg: head.reverseCharge,
        inv_typ: "R",
        itms: items(rates),
      })),
    }));
  }

  if (b2cl.length > 0) {
    // b2cl is grouped by place of supply, then by invoice.
    const byPos = new Map<string, typeof b2cl>();
    for (const r of b2cl) {
      const pos = normalizeStateCode(r.placeOfSupply.split("-")[0]);
      if (!byPos.has(pos)) byPos.set(pos, []);
      byPos.get(pos)!.push(r);
    }
    json.b2cl = [...byPos.entries()].map(([pos, rows]) => ({
      pos,
      inv: groupByInvoice(rows).map(({ head, rates }) => ({
        inum: head.invoiceNumber,
        idt: portalDate(head.invoiceDate),
        val: head.invoiceValue,
        itms: items(rates),
      })),
    }));
  }

  if (b2cs.length > 0) {
    json.b2cs = b2cs.map((r) => {
      const pos = normalizeStateCode(r.placeOfSupply.split("-")[0]);
      // Inter-state carries IGST, intra-state carries CGST+SGST -- the stored amounts
      // say which, so the supply type is read off them rather than guessed.
      const inter = r.igst > 0;
      return {
        sply_ty: inter ? "INTER" : "INTRA",
        typ: r.type,
        pos,
        rt: r.rate,
        txval: r.taxableValue,
        iamt: r.igst,
        camt: r.cgst,
        samt: r.sgst,
        csamt: r.cess,
      };
    });
  }

  if (hsn.length > 0) {
    json.hsn = {
      data: hsn.map((h, i) => ({
        num: i + 1,
        hsn_sc: h.hsn,
        desc: h.description,
        uqc: h.uqc,
        qty: h.quantity,
        val: h.totalValue,
        txval: h.taxableValue,
        iamt: h.igst,
        camt: h.cgst,
        samt: h.sgst,
        csamt: h.cess,
      })),
    };
  }

  if (docs.total > 0) {
    json.doc_issue = {
      doc_det: [
        {
          doc_num: 1, // 1 = invoices for outward supply
          docs: [
            {
              num: 1,
              from: docs.from,
              to: docs.to,
              totnum: docs.total,
              cancel: docs.cancelled,
              net_issue: docs.total - docs.cancelled,
            },
          ],
        },
      ],
    };
  }

  return json;
}

/** Portal filenames can't carry slashes or spaces, which invoice numbers are full of. */
export function gstJsonFileName(gstin: string, period: string): string {
  return `GSTR1_${gstin}_${period}_${Date.now().toString(36)}.json`;
}

export function jsonByteSize(json: Record<string, unknown>): number {
  return Buffer.byteLength(JSON.stringify(json), "utf8");
}

/** Rounds every money field once more on the way out -- the portal rejects values with
 * more than two decimals, which float arithmetic can otherwise produce. */
export function roundJsonMoney(value: unknown): unknown {
  if (typeof value === "number") return Number.isInteger(value) ? value : round2(value);
  if (Array.isArray(value)) return value.map(roundJsonMoney);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([k, v]) => [k, roundJsonMoney(v)]));
  }
  return value;
}
