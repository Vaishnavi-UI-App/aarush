"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Transaction {
  id: string;
  date: string;
  description: string;
  amount: number;
  type: "CREDIT" | "DEBIT";
  matchStatus: "UNMATCHED" | "MATCHED";
  matchedLabel: string | null;
}

interface Option {
  id: string;
  label: string;
}

export default function TransactionRow({
  transaction,
  unmatchedPayments,
  unmatchedVendorPayments,
}: {
  transaction: Transaction;
  unmatchedPayments: Option[];
  unmatchedVendorPayments: Option[];
}) {
  const router = useRouter();
  const [selected, setSelected] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const options = transaction.type === "CREDIT" ? unmatchedPayments : unmatchedVendorPayments;

  async function match() {
    if (!selected) return;
    setSaving(true);
    setError(null);
    try {
      const isVendor = transaction.type === "DEBIT";
      const res = await fetch(`/api/bank-transactions/${transaction.id}/match`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(isVendor ? { vendorPaymentId: selected } : { paymentId: selected }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to match");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to match");
    } finally {
      setSaving(false);
    }
  }

  return (
    <tr>
      <td>{new Date(transaction.date).toLocaleDateString("en-IN")}</td>
      <td>{transaction.description}</td>
      <td>{transaction.type}</td>
      <td>Rs. {transaction.amount.toFixed(2)}</td>
      <td>
        {transaction.matchStatus === "MATCHED" ? (
          <span className="afs-badge afs-badge-paid">Matched: {transaction.matchedLabel}</span>
        ) : options.length === 0 ? (
          <span style={{ fontSize: 12, color: "#889" }}>No unmatched payments</span>
        ) : (
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <select value={selected} onChange={(e) => setSelected(e.target.value)} style={{ fontSize: 12 }}>
              <option value="">Select payment…</option>
              {options.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </select>
            <button onClick={match} disabled={!selected || saving} className="afs-btn afs-btn-gold" style={{ padding: "4px 10px", fontSize: 12 }}>
              Match
            </button>
            {error && <span style={{ color: "#b91c1c", fontSize: 11 }}>{error}</span>}
          </div>
        )}
      </td>
    </tr>
  );
}
