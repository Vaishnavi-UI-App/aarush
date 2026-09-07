/** Shared between the full-page customer ledger (server-rendered) and the inline
 * ledger modal on the Banking dashboard (client-fetched) -- both need to fold a
 * multi-invoice payment's consecutive rows into one collapsible entry the same way. */
export interface LedgerEntryView {
  id: string;
  entryDate: string;
  refType: string;
  description: string;
  invoiceId: string | null;
  paymentId: string | null;
  debit: number;
  credit: number;
  runningBalance: number;
}

export type LedgerRow =
  | { kind: "single"; entry: LedgerEntryView }
  | { kind: "batch"; batchId: string; entries: LedgerEntryView[] };

/** A payment split across several invoices in one "Record Payment" submission
 * shares a batchId -- fold its consecutive ledger rows into one collapsible entry
 * instead of showing one row per invoice it touched. `batchIdByPaymentId` looks up
 * each PAYMENT entry's batchId (null/undefined for a payment that was never split). */
export function groupLedgerRows(entries: LedgerEntryView[], batchIdByPaymentId: Map<string, string | null>): LedgerRow[] {
  const rows: LedgerRow[] = [];
  for (const entry of entries) {
    const batchId = entry.refType === "PAYMENT" && entry.paymentId ? (batchIdByPaymentId.get(entry.paymentId) ?? null) : null;
    const last = rows[rows.length - 1];
    if (batchId && last?.kind === "batch" && last.batchId === batchId) {
      last.entries.push(entry);
    } else if (batchId) {
      rows.push({ kind: "batch", batchId, entries: [entry] });
    } else {
      rows.push({ kind: "single", entry });
    }
  }
  return rows;
}
