import { round2 } from "@/lib/gst-invoice";

/** The subset of a ledger entry (plus its linked invoice/payment) needed to render
 * one row of a Tally-style "Ledger Account" statement. */
export interface RawLedgerEntry {
  entryDate: Date;
  refType: string;
  debit: number;
  credit: number;
  invoiceNumber?: string | null;
  paymentMode?: string | null;
  paymentReferenceNo?: string | null;
}

export interface TallyLedgerRow {
  date: Date;
  particulars: string;
  vchType: string;
  vchNo: string;
  debit: number;
  credit: number;
}

const PAYMENT_MODE_LABELS: Record<string, string> = {
  CASH: "Cash",
  UPI: "UPI",
  BANK_TRANSFER: "Bank Transfer",
  CHEQUE: "Cheque",
  OTHER: "Other",
};

function titleCase(s: string): string {
  return s
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Reshapes raw ledger entries into the Date/Particulars/Vch Type/Vch No./Debit/Credit
 * rows of a traditional "Ledger Account" statement (the format Tally and similar
 * accounting software print) -- as opposed to this app's own running-balance table.
 * Vch No. for a receipt is a per-statement sequential counter (1, 2, 3...), matching
 * how such statements read, since individual payments here aren't assigned a
 * persistent receipt number of their own. */
export function buildTallyLedgerRows(entries: RawLedgerEntry[]): TallyLedgerRow[] {
  let receiptNo = 0;
  return entries.map((e) => {
    if (e.refType === "INVOICE") {
      return { date: e.entryDate, particulars: "To Sales", vchType: "Sales", vchNo: e.invoiceNumber ?? "", debit: e.debit, credit: e.credit };
    }
    if (e.refType === "PAYMENT") {
      receiptNo += 1;
      const modeLabel = e.paymentMode ? (PAYMENT_MODE_LABELS[e.paymentMode] ?? e.paymentMode) : "Payment";
      const particulars = e.paymentReferenceNo ? `By ${modeLabel} (${e.paymentReferenceNo})` : `By ${modeLabel}`;
      return { date: e.entryDate, particulars, vchType: "Receipt", vchNo: String(receiptNo), debit: e.debit, credit: e.credit };
    }
    const label = titleCase(e.refType);
    return { date: e.entryDate, particulars: `${e.debit > 0 ? "To" : "By"} ${label}`, vchType: label, vchNo: "", debit: e.debit, credit: e.credit };
  });
}

/** The plug row that balances the Debit/Credit totals at the foot of the statement --
 * "By Closing Balance" on the credit side when the account nets to a debit (due)
 * balance, or "To Closing Balance" on the debit side when it nets to a credit
 * (advance) balance. */
export function closingBalancePlug(rows: TallyLedgerRow[]): { amount: number; side: "debit" | "credit" } {
  const totalDebit = round2(rows.reduce((s, r) => s + r.debit, 0));
  const totalCredit = round2(rows.reduce((s, r) => s + r.credit, 0));
  const diff = round2(totalDebit - totalCredit);
  return diff >= 0 ? { amount: diff, side: "credit" } : { amount: round2(-diff), side: "debit" };
}

function csvCell(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

/** Renders one customer's Tally-style rows (plus totals and the closing-balance
 * plug) as CSV lines, optionally prefixed with a Customer column for a combined,
 * multi-customer export. */
export function tallyLedgerCsvLines(customerName: string | null, rows: TallyLedgerRow[]): string[] {
  const totalDebit = round2(rows.reduce((s, r) => s + r.debit, 0));
  const totalCredit = round2(rows.reduce((s, r) => s + r.credit, 0));
  const plug = closingBalancePlug(rows);

  const bodyRows: string[][] = [
    ...rows.map((r) => [
      r.date.toLocaleDateString("en-IN"),
      r.particulars,
      r.vchType,
      r.vchNo,
      r.debit > 0 ? r.debit.toFixed(2) : "",
      r.credit > 0 ? r.credit.toFixed(2) : "",
    ]),
    ["", "Total", "", "", totalDebit.toFixed(2), totalCredit.toFixed(2)],
    ["", "Closing Balance", "", "", plug.side === "debit" ? plug.amount.toFixed(2) : "", plug.side === "credit" ? plug.amount.toFixed(2) : ""],
  ];

  return bodyRows.map((cells) => (customerName !== null ? [customerName, ...cells] : cells).map(csvCell).join(","));
}

export function tallyLedgerCsvHeader(withCustomer: boolean): string {
  const header = ["Date", "Particulars", "Vch Type", "Vch No.", "Debit", "Credit"];
  return (withCustomer ? ["Customer", ...header] : header).map(csvCell).join(",");
}
