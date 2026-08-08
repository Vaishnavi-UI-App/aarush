"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

interface UnpaidInvoice {
  id: string;
  number: string;
  due: number;
}

interface CustomerOption {
  id: string;
  name: string;
  unpaidInvoices: UnpaidInvoice[];
}

function money(n: number): string {
  return n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function RecordPaymentModal({ customers, onClose }: { customers: CustomerOption[]; onClose: () => void }) {
  const router = useRouter();
  const [customerId, setCustomerId] = useState(customers[0]?.id ?? "");
  // Which invoices are checked, and how much of this payment goes to each -- lets
  // the person recording the payment choose which bills to clear (not just oldest
  // first) and split the amount across them, including paying one only partially.
  const [selectedAmounts, setSelectedAmounts] = useState<Record<string, string>>({});
  const [generalAmount, setGeneralAmount] = useState("");
  const [mode, setMode] = useState("CASH");
  const [referenceNo, setReferenceNo] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const selectedCustomer = customers.find((c) => c.id === customerId);

  function toggleInvoice(inv: UnpaidInvoice, checked: boolean) {
    setSelectedAmounts((prev) => {
      const next = { ...prev };
      if (checked) {
        next[inv.id] = inv.due.toFixed(2);
      } else {
        delete next[inv.id];
      }
      return next;
    });
  }

  function setInvoiceAmount(invoiceId: string, value: string) {
    setSelectedAmounts((prev) => ({ ...prev, [invoiceId]: value }));
  }

  const total = useMemo(() => {
    const invoiceSum = Object.values(selectedAmounts).reduce((sum, v) => sum + (Number(v) || 0), 0);
    return invoiceSum + (Number(generalAmount) || 0);
  }, [selectedAmounts, generalAmount]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const allocations = [
      ...Object.entries(selectedAmounts)
        .filter(([, amt]) => Number(amt) > 0)
        .map(([invoiceId, amt]) => ({ invoiceId, amount: Number(amt) })),
      ...(Number(generalAmount) > 0 ? [{ amount: Number(generalAmount) }] : []),
    ];
    if (allocations.length === 0) {
      setError("Enter an amount against at least one invoice, or a general amount.");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(`/api/customers/${customerId}/payments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ allocations, mode, referenceNo: referenceNo || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to record payment");
      router.refresh();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to record payment");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="bk-modal-backdrop" onClick={onClose}>
      <div className="bk-modal" onClick={(e) => e.stopPropagation()}>
        <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>Record Payment</h2>
        <form onSubmit={onSubmit}>
          <div className="afs-form-field" style={{ marginBottom: 12 }}>
            <label>Customer *</label>
            <select
              required
              value={customerId}
              onChange={(e) => {
                setCustomerId(e.target.value);
                setSelectedAmounts({});
              }}
            >
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div className="afs-form-field" style={{ marginBottom: 4 }}>
            <label>Apply to invoices (optional -- tick any, edit the amount to pay part of one)</label>
          </div>
          {selectedCustomer && selectedCustomer.unpaidInvoices.length > 0 ? (
            <div style={{ marginBottom: 12, display: "flex", flexDirection: "column", gap: 6 }}>
              {selectedCustomer.unpaidInvoices.map((inv) => {
                const checked = inv.id in selectedAmounts;
                return (
                  <div
                    key={inv.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      padding: "6px 8px",
                      border: "1px solid #e5e7eb",
                      borderRadius: 8,
                      background: checked ? "#eaf1ff" : "#fff",
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(e) => toggleInvoice(inv, e.target.checked)}
                      style={{ width: 18, height: 18, flexShrink: 0 }}
                    />
                    <div style={{ flex: 1, minWidth: 0, fontSize: 13 }}>
                      <div style={{ fontWeight: 600 }}>{inv.number}</div>
                      <div style={{ color: "#667", fontSize: 12 }}>due Rs. {money(inv.due)}</div>
                    </div>
                    {checked && (
                      <input
                        type="number"
                        min="0.01"
                        max={inv.due}
                        step="0.01"
                        value={selectedAmounts[inv.id]}
                        onChange={(e) => setInvoiceAmount(inv.id, e.target.value)}
                        style={{ width: 100, padding: "6px 8px", borderRadius: 6, border: "1px solid #ccd2e0", fontSize: 13 }}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div style={{ marginBottom: 12, fontSize: 12, color: "#889" }}>No unpaid invoices for this customer.</div>
          )}

          <div className="afs-form-field" style={{ marginBottom: 12 }}>
            <label>General amount (not tied to an invoice)</label>
            <input type="number" min="0" step="0.01" value={generalAmount} onChange={(e) => setGeneralAmount(e.target.value)} />
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, fontWeight: 700, marginBottom: 12, padding: "8px 0", borderTop: "1px solid #eee" }}>
            <span>Total to record</span>
            <span>Rs. {money(total)}</span>
          </div>

          <div className="afs-form-field" style={{ marginBottom: 12 }}>
            <label>Mode *</label>
            <select value={mode} onChange={(e) => setMode(e.target.value)}>
              {["CASH", "UPI", "BANK_TRANSFER", "CHEQUE", "OTHER"].map((m) => (
                <option key={m} value={m}>
                  {m.replace("_", " ")}
                </option>
              ))}
            </select>
          </div>

          <div className="afs-form-field" style={{ marginBottom: 16 }}>
            <label>Reference no.</label>
            <input value={referenceNo} onChange={(e) => setReferenceNo(e.target.value)} />
          </div>

          {error && <div style={{ color: "#b91c1c", fontSize: 13, marginBottom: 12 }}>{error}</div>}

          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
            <button type="button" onClick={onClose} className="afs-btn" style={{ background: "#e5e7eb", color: "#333" }}>
              Cancel
            </button>
            <button type="submit" disabled={saving} className="afs-btn afs-btn-primary">
              {saving ? "Recording…" : "Record Payment"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
