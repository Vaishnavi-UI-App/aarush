"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import DeletePaymentButton from "./DeletePaymentButton";

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

function money(n: number): string {
  return Math.abs(n).toFixed(2);
}

function BalanceCell({ balance }: { balance: number }) {
  return (
    <td data-label="Balance" style={{ color: balance > 0 ? "var(--afs-maroon)" : balance < 0 ? "#14532d" : undefined }}>
      Rs. {money(balance)} {balance > 0 ? "due" : balance < 0 ? "advance" : ""}
    </td>
  );
}

function EntryActions({ customerId, entry, canDelete }: { customerId: string; entry: LedgerEntryView; canDelete: boolean }) {
  if (canDelete && entry.refType === "PAYMENT" && entry.paymentId) {
    return <DeletePaymentButton customerId={customerId} paymentId={entry.paymentId} />;
  }
  if (entry.refType === "INVOICE" && entry.invoiceId) {
    return (
      <Link href={`/invoices/${entry.invoiceId}`} style={{ fontSize: 12 }}>
        Delete from invoice →
      </Link>
    );
  }
  return <>—</>;
}

function BatchRow({ customerId, batchId, entries, canDelete }: { customerId: string; batchId: string; entries: LedgerEntryView[]; canDelete: boolean }) {
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const totalCredit = entries.reduce((sum, e) => sum + e.credit, 0);
  const finalBalance = entries[entries.length - 1].runningBalance;

  async function deleteBatch() {
    if (!window.confirm(`Delete this whole payment entry (${entries.length} invoices)? This only corrects the books -- it does not refund any money. This can't be undone.`))
      return;
    setDeleting(true);
    setError(null);
    try {
      const res = await fetch(`/api/customers/${customerId}/payment-batches/${batchId}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to delete payment");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete payment");
      setDeleting(false);
    }
  }

  return (
    <>
      <tr style={{ cursor: "pointer", background: expanded ? "#f7f9fc" : undefined }} onClick={() => setExpanded((v) => !v)}>
        <td data-label="Date">{new Date(entries[0].entryDate).toLocaleDateString("en-IN")}</td>
        <td data-label="Type">PAYMENT</td>
        <td data-label="Description">
          <span style={{ marginRight: 6 }}>{expanded ? "▾" : "▸"}</span>
          Payment received, split across {entries.length} invoices
        </td>
        <td data-label="Debit">—</td>
        <td data-label="Credit">{money(totalCredit)}</td>
        <BalanceCell balance={finalBalance} />
        <td data-label="Actions" onClick={(e) => e.stopPropagation()}>
          {canDelete ? (
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <button type="button" onClick={deleteBatch} disabled={deleting} className="afs-btn" style={{ fontSize: 12, padding: "4px 10px" }}>
                Delete all
              </button>
              {error && <span style={{ color: "#b91c1c", fontSize: 11 }}>{error}</span>}
            </div>
          ) : (
            "—"
          )}
        </td>
      </tr>
      {expanded &&
        entries.map((entry) => (
          <tr key={entry.id} style={{ background: "#fbfcfe" }}>
            <td data-label="Date" />
            <td data-label="Type">{entry.refType}</td>
            <td data-label="Description" style={{ paddingLeft: 20 }}>
              {entry.invoiceId ? <Link href={`/invoices/${entry.invoiceId}`}>{entry.description}</Link> : entry.description}
            </td>
            <td data-label="Debit">{entry.debit > 0 ? money(entry.debit) : "—"}</td>
            <td data-label="Credit">{entry.credit > 0 ? money(entry.credit) : "—"}</td>
            <BalanceCell balance={entry.runningBalance} />
            <td data-label="Actions">
              <EntryActions customerId={customerId} entry={entry} canDelete={canDelete} />
            </td>
          </tr>
        ))}
    </>
  );
}

export default function CustomerLedgerTable({ customerId, rows, canDelete }: { customerId: string; rows: LedgerRow[]; canDelete: boolean }) {
  return (
    <table className="afs-table">
      <thead>
        <tr>
          <th>Date</th>
          <th>Type</th>
          <th>Description</th>
          <th>Debit</th>
          <th>Credit</th>
          <th>Balance</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) =>
          row.kind === "batch" ? (
            <BatchRow key={row.batchId} customerId={customerId} batchId={row.batchId} entries={row.entries} canDelete={canDelete} />
          ) : (
            <tr key={row.entry.id}>
              <td data-label="Date">{new Date(row.entry.entryDate).toLocaleDateString("en-IN")}</td>
              <td data-label="Type">{row.entry.refType}</td>
              <td data-label="Description">
                {row.entry.invoiceId ? <Link href={`/invoices/${row.entry.invoiceId}`}>{row.entry.description}</Link> : row.entry.description}
              </td>
              <td data-label="Debit">{row.entry.debit > 0 ? money(row.entry.debit) : "—"}</td>
              <td data-label="Credit">{row.entry.credit > 0 ? money(row.entry.credit) : "—"}</td>
              <BalanceCell balance={row.entry.runningBalance} />
              <td data-label="Actions">
                <EntryActions customerId={customerId} entry={row.entry} canDelete={canDelete} />
              </td>
            </tr>
          )
        )}
      </tbody>
    </table>
  );
}
