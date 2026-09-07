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
  // A payment split across several invoices in one "Record Payment" submission
  // shares this -- lets buildTallyLedgerRows fold them back into the one receipt
  // they really were, instead of one line per invoice it happened to be applied to.
  paymentBatchId?: string | null;
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

interface RowAccumulator extends TallyLedgerRow {
  _batchId?: string | null;
}

/** Reshapes raw ledger entries into the Date/Particulars/Vch Type/Vch No./Debit/Credit
 * rows of a traditional "Ledger Account" statement (the format Tally and similar
 * accounting software print) -- as opposed to this app's own running-balance table.
 * Vch No. for a receipt is a per-statement sequential counter (1, 2, 3...), matching
 * how such statements read, since individual payments here aren't assigned a
 * persistent receipt number of their own. A batched payment collapses to the single
 * receipt it really was, same as the on-screen ledger's collapsible batch row.
 *
 * Rows come out in transaction-date order, not the order they were entered into the
 * system -- a backdated payment belongs where it actually happened, the way a printed
 * ledger reads. Safe to reorder here because this statement has no running-balance
 * column: its totals and closing balance are plain sums. The sort is stable, so
 * same-date entries keep their insertion order (which is how the callers fetch them),
 * and a batch's allocations stay adjacent for the grouping below. */
export function buildTallyLedgerRows(entries: RawLedgerEntry[]): TallyLedgerRow[] {
  let receiptNo = 0;
  const rows: RowAccumulator[] = [];
  const chronological = [...entries].sort((a, b) => a.entryDate.getTime() - b.entryDate.getTime());
  for (const e of chronological) {
    if (e.refType === "INVOICE") {
      rows.push({ date: e.entryDate, particulars: "To Sales", vchType: "Sales", vchNo: e.invoiceNumber ?? "", debit: e.debit, credit: e.credit });
      continue;
    }
    if (e.refType === "PAYMENT") {
      const last = rows[rows.length - 1];
      if (e.paymentBatchId && last?.vchType === "Receipt" && last._batchId === e.paymentBatchId) {
        last.credit = round2(last.credit + e.credit);
        continue;
      }
      receiptNo += 1;
      const modeLabel = e.paymentMode ? (PAYMENT_MODE_LABELS[e.paymentMode] ?? e.paymentMode) : "Payment";
      const particulars = e.paymentReferenceNo ? `By ${modeLabel} (${e.paymentReferenceNo})` : `By ${modeLabel}`;
      rows.push({
        date: e.entryDate,
        particulars,
        vchType: "Receipt",
        vchNo: String(receiptNo),
        debit: e.debit,
        credit: e.credit,
        _batchId: e.paymentBatchId,
      });
      continue;
    }
    const label = titleCase(e.refType);
    rows.push({ date: e.entryDate, particulars: `${e.debit > 0 ? "To" : "By"} ${label}`, vchType: label, vchNo: "", debit: e.debit, credit: e.credit });
  }
  return rows.map((r) => ({ date: r.date, particulars: r.particulars, vchType: r.vchType, vchNo: r.vchNo, debit: r.debit, credit: r.credit }));
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
