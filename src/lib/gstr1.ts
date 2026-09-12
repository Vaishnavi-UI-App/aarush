import { round2 } from "@/lib/gst-invoice";
import { normalizeStateCode, placeOfSupplyLabel } from "@/lib/state-codes";

/** Inter-state supplies to an unregistered buyer go in B2CL once the invoice crosses
 * this value; below it they're summarised into B2CS instead. The limit was cut from
 * Rs. 2,50,000 to Rs. 1,00,000 by Notification 12/2024-Central Tax, effective for
 * returns from November 2024 onward. */
export const B2CL_THRESHOLD = 100000;

export interface Gstr1Company {
  name: string;
  gstin: string;
  stateCode: string;
  phone: string | null;
}

export interface Gstr1Customer {
  name: string;
  gstin: string | null;
  stateCode: string;
}

export interface Gstr1Line {
  hsnCode: string;
  description: string;
  unit: string;
  qty: number;
  taxableValue: number;
  taxRate: number;
  cgstAmount: number;
  sgstAmount: number;
  igstAmount: number;
}

export interface Gstr1Invoice {
  number: string;
  date: Date;
  total: number;
  /** CANCELLED invoices are counted in the documents summary but kept out of the tax
   * sheets -- they were issued, so the series has to account for them, but no supply
   * took place. */
  cancelled: boolean;
  /** Place of supply is the recipient's state: the ship-to state when the goods went
   * somewhere other than the billing address, otherwise the customer's own state. */
  placeOfSupplyStateCode: string;
  reverseCharge: boolean;
  lines: Gstr1Line[];
}

export type SupplyType = "b2b" | "b2cl" | "b2cs";

/** One (invoice, tax rate) pair. GSTR-1 wants a row per rate, so an invoice billed at
 * both 18% and 28% contributes two rows with its header details repeated. */
export interface RateRow {
  rate: number;
  taxableValue: number;
  cgst: number;
  sgst: number;
  igst: number;
  cess: number;
}

export interface B2bRow extends RateRow {
  gstin: string;
  receiverName: string;
  invoiceNumber: string;
  invoiceDate: Date;
  invoiceValue: number;
  placeOfSupply: string;
  reverseCharge: "Y" | "N";
}

export interface B2clRow extends RateRow {
  invoiceNumber: string;
  invoiceDate: Date;
  invoiceValue: number;
  placeOfSupply: string;
}

export interface B2csRow extends RateRow {
  type: "OE";
  placeOfSupply: string;
}

export interface HsnRow {
  hsn: string;
  description: string;
  uqc: string;
  quantity: number;
  totalValue: number;
  rate: number;
  taxableValue: number;
  igst: number;
  cgst: number;
  sgst: number;
  cess: number;
}

export interface DocsSummary {
  from: string;
  to: string;
  total: number;
  cancelled: number;
}

/** Cess isn't modelled anywhere in this system -- no invoice or line carries it -- but
 * every GSTR-1 sheet has a column for it, so it's emitted as a literal zero rather
 * than silently dropped. */
const CESS = 0;

export function classifyInvoice(invoice: Gstr1Invoice, customer: Gstr1Customer, companyStateCode: string): SupplyType {
  if (customer.gstin && customer.gstin.trim()) return "b2b";
  const interState = normalizeStateCode(invoice.placeOfSupplyStateCode) !== normalizeStateCode(companyStateCode);
  if (interState && invoice.total > B2CL_THRESHOLD) return "b2cl";
  return "b2cs";
}

/** Collapses an invoice's lines into one entry per tax rate. Tax amounts come from what
 * was stored on the line when the invoice was raised rather than being recomputed from
 * the rate -- the filing has to agree with the document the customer was actually
 * given, down to the paisa. */
export function rateRowsFor(invoice: Gstr1Invoice): RateRow[] {
  const byRate = new Map<number, RateRow>();
  for (const line of invoice.lines) {
    const rate = Number(line.taxRate);
    const acc = byRate.get(rate) ?? { rate, taxableValue: 0, cgst: 0, sgst: 0, igst: 0, cess: CESS };
    acc.taxableValue += Number(line.taxableValue);
    acc.cgst += Number(line.cgstAmount);
    acc.sgst += Number(line.sgstAmount);
    acc.igst += Number(line.igstAmount);
    byRate.set(rate, acc);
  }
  return [...byRate.values()]
    .map((r) => ({
      ...r,
      taxableValue: round2(r.taxableValue),
      cgst: round2(r.cgst),
      sgst: round2(r.sgst),
      igst: round2(r.igst),
    }))
    .sort((a, b) => a.rate - b.rate);
}

export function buildB2b(invoices: Gstr1Invoice[], customer: Gstr1Customer): B2bRow[] {
  return invoices.flatMap((inv) =>
    rateRowsFor(inv).map((r) => ({
      ...r,
      gstin: customer.gstin ?? "",
      receiverName: customer.name,
      invoiceNumber: inv.number,
      invoiceDate: inv.date,
      invoiceValue: round2(inv.total),
      placeOfSupply: placeOfSupplyLabel(inv.placeOfSupplyStateCode),
      reverseCharge: (inv.reverseCharge ? "Y" : "N") as "Y" | "N",
    }))
  );
}

export function buildB2cl(invoices: Gstr1Invoice[]): B2clRow[] {
  return invoices.flatMap((inv) =>
    rateRowsFor(inv).map((r) => ({
      ...r,
      invoiceNumber: inv.number,
      invoiceDate: inv.date,
      invoiceValue: round2(inv.total),
      placeOfSupply: placeOfSupplyLabel(inv.placeOfSupplyStateCode),
    }))
  );
}

/** B2CS is summarised, not itemised: the return carries one line per place of supply and
 * rate for the whole period, with no invoice numbers. */
export function buildB2cs(invoices: Gstr1Invoice[]): B2csRow[] {
  const byKey = new Map<string, B2csRow>();
  for (const inv of invoices) {
    const pos = placeOfSupplyLabel(inv.placeOfSupplyStateCode);
    for (const r of rateRowsFor(inv)) {
      const key = `${pos}|${r.rate}`;
      const acc = byKey.get(key) ?? { type: "OE" as const, placeOfSupply: pos, rate: r.rate, taxableValue: 0, cgst: 0, sgst: 0, igst: 0, cess: CESS };
      acc.taxableValue += r.taxableValue;
      acc.cgst += r.cgst;
      acc.sgst += r.sgst;
      acc.igst += r.igst;
      byKey.set(key, acc);
    }
  }
  return [...byKey.values()]
    .map((r) => ({ ...r, taxableValue: round2(r.taxableValue), cgst: round2(r.cgst), sgst: round2(r.sgst), igst: round2(r.igst) }))
    .sort((a, b) => a.placeOfSupply.localeCompare(b.placeOfSupply) || a.rate - b.rate);
}

/** Grouped by HSN *and* rate, not by HSN alone: the sheet carries a single Rate column,
 * so one HSN billed at two different rates has to be reported as two rows -- there'd be
 * no truthful value to put in that column otherwise. */
export function buildHsnSummary(invoices: Gstr1Invoice[]): HsnRow[] {
  const byKey = new Map<string, HsnRow>();
  for (const inv of invoices) {
    for (const line of inv.lines) {
      const rate = Number(line.taxRate);
      const uqc = (line.unit || "NOS").toUpperCase();
      const key = `${line.hsnCode}|${uqc}|${rate}`;
      const acc =
        byKey.get(key) ??
        { hsn: line.hsnCode, description: line.description, uqc, quantity: 0, totalValue: 0, rate, taxableValue: 0, igst: 0, cgst: 0, sgst: 0, cess: CESS };
      const taxable = Number(line.taxableValue);
      const cgst = Number(line.cgstAmount);
      const sgst = Number(line.sgstAmount);
      const igst = Number(line.igstAmount);
      acc.quantity += Number(line.qty);
      acc.taxableValue += taxable;
      acc.cgst += cgst;
      acc.sgst += sgst;
      acc.igst += igst;
      // Total value is taxable value plus the tax on it -- what the line was worth.
      acc.totalValue += taxable + cgst + sgst + igst;
      byKey.set(key, acc);
    }
  }
  return [...byKey.values()]
    .map((r) => ({
      ...r,
      quantity: round2(r.quantity),
      totalValue: round2(r.totalValue),
      taxableValue: round2(r.taxableValue),
      cgst: round2(r.cgst),
      sgst: round2(r.sgst),
      igst: round2(r.igst),
    }))
    .sort((a, b) => a.hsn.localeCompare(b.hsn) || a.rate - b.rate);
}

/** Invoice numbers here look like "INV/26-27/439", so a plain string sort puts /9 after
 * /439. Compare the trailing serial numerically when both numbers share a prefix. */
function compareInvoiceNumbers(a: string, b: string): number {
  const serial = (s: string) => {
    const m = s.match(/(\d+)\s*$/);
    return m ? Number(m[1]) : null;
  };
  const prefix = (s: string) => s.replace(/(\d+)\s*$/, "");
  const [sa, sb] = [serial(a), serial(b)];
  if (sa !== null && sb !== null && prefix(a) === prefix(b)) return sa - sb;
  return a.localeCompare(b);
}

/** Covers every document issued in the period, cancelled ones included -- the point of
 * the summary is that the number series is continuous and accounted for. */
export function buildDocsSummary(issued: Gstr1Invoice[]): DocsSummary {
  if (issued.length === 0) return { from: "", to: "", total: 0, cancelled: 0 };
  const numbers = issued.map((i) => i.number).sort(compareInvoiceNumbers);
  return {
    from: numbers[0],
    to: numbers[numbers.length - 1],
    total: issued.length,
    cancelled: issued.filter((i) => i.cancelled).length,
  };
}

export function totalTaxOf(r: RateRow): number {
  return round2(r.cgst + r.sgst + r.igst);
}

/** Read in UTC, not local time. Invoice dates are stored as UTC midnights and the period
 * bounds are UTC day boundaries, so formatting them through a local calendar shifts the
 * end of a period into the next day for anyone east of Greenwich -- a period ending
 * 31 Aug would print as 01/09. */
export function formatGstDate(d: Date): string {
  const dd = String(d.getUTCDate()).padStart(2, "0");
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${dd}/${mm}/${d.getUTCFullYear()}`;
}
