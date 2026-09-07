"use client";

import { useCallback, useEffect, useState } from "react";
import { groupLedgerRows, LedgerRow } from "@/lib/customer-ledger-rows";
import CustomerLedgerTable from "./CustomerLedgerTable";

interface RawEntry {
  id: string;
  entryDate: string;
  refType: string;
  description: string;
  invoiceId: string | null;
  paymentId: string | null;
  debit: string | number;
  credit: string | number;
  runningBalance: string | number;
  payment: { batchId: string | null } | null;
}

/** Shows one customer's full ledger inline, without leaving the page it's opened
 * from -- used by the Banking dashboard's "View" action so a quick look at a
 * customer's history doesn't require navigating away to their own page. */
export default function CustomerLedgerModal({
  customerId,
  customerName,
  canDelete,
  onClose,
}: {
  customerId: string;
  customerName: string;
  canDelete: boolean;
  onClose: () => void;
}) {
  const [rows, setRows] = useState<LedgerRow[] | null>(null);
  const [currentDue, setCurrentDue] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch(`/api/customers/${customerId}/ledger`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load ledger");
      const entries: RawEntry[] = data.entries;
      const batchIdByPaymentId = new Map(entries.filter((e) => e.paymentId).map((e) => [e.paymentId!, e.payment?.batchId ?? null]));
      setRows(
        groupLedgerRows(
          entries.map((e) => ({
            id: e.id,
            entryDate: e.entryDate,
            refType: e.refType,
            description: e.description,
            invoiceId: e.invoiceId,
            paymentId: e.paymentId,
            debit: Number(e.debit),
            credit: Number(e.credit),
            runningBalance: Number(e.runningBalance),
          })),
          batchIdByPaymentId
        )
      );
      setCurrentDue(Number(data.currentDue));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load ledger");
    }
  }, [customerId]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="bk-modal-backdrop" onClick={onClose}>
      <div className="bk-modal bk-modal-wide" onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
          <div>
            <h2 style={{ fontSize: 16, fontWeight: 700 }}>{customerName}</h2>
            <div style={{ fontSize: 12, color: "#667", marginTop: 4 }}>
              {currentDue > 0 ? "Current Due" : currentDue < 0 ? "Advance Balance" : "Settled"}:{" "}
              <strong style={{ color: currentDue > 0 ? "var(--afs-maroon)" : "#14532d" }}>Rs. {Math.abs(currentDue).toFixed(2)}</strong>
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <a href={`/customers/${customerId}`} style={{ fontSize: 12 }}>
              Open full page →
            </a>
            <button type="button" onClick={onClose} className="afs-btn" style={{ background: "#e5e7eb", color: "#333" }}>
              Close
            </button>
          </div>
        </div>

        {error && <div style={{ color: "#b91c1c", fontSize: 13, marginBottom: 12 }}>{error}</div>}

        {rows === null ? (
          <div className="afs-empty">Loading…</div>
        ) : rows.length === 0 ? (
          <div className="afs-empty">No transactions yet.</div>
        ) : (
          <div style={{ maxHeight: "60vh", overflowY: "auto" }}>
            <CustomerLedgerTable customerId={customerId} rows={rows} canDelete={canDelete} onChanged={load} />
          </div>
        )}
      </div>
    </div>
  );
}
