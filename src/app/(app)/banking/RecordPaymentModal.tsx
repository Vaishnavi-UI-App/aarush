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

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export default function RecordPaymentModal({ customers, onClose }: { customers: CustomerOption[]; onClose: () => void }) {
  const router = useRouter();
  const [customerId, setCustomerId] = useState(customers[0]?.id ?? "");
  // Which invoices the person recording the payment has explicitly ticked/edited, and
  // how much of this payment goes to each -- lets them choose which bills to clear
  // (not just oldest first) and split the amount across them, including paying one
  // only partially.
  const [selectedAmounts, setSelectedAmounts] = useState<Record<string, string>>({});
  // Invoices the auto-apply cascade below would otherwise cover, but the user opted
  // out of -- so its share of the general amount flows to the next invoice instead.
  const [excludedIds, setExcludedIds] = useState<Set<string>>(new Set());
  const [generalAmount, setGeneralAmount] = useState("");
  const [mode, setMode] = useState("CASH");
  const [referenceNo, setReferenceNo] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const selectedCustomer = customers.find((c) => c.id === customerId);

  // Any amount typed into "General amount" that isn't already spoken for by a
  // manually-ticked invoice first goes toward paying off the customer's other unpaid
  // invoices, oldest first -- only the true leftover (after every unpaid invoice is
  // covered) ends up as an unapplied advance credit.
  const autoFill = useMemo(() => {
    const pool = Number(generalAmount) || 0;
    let remaining = pool;
    const applied: Record<string, number> = {};
    if (selectedCustomer) {
      for (const inv of selectedCustomer.unpaidInvoices) {
        if (remaining <= 0) break;
        if (inv.id in selectedAmounts) continue;
        if (excludedIds.has(inv.id)) continue;
        const amt = round2(Math.min(remaining, inv.due));
        if (amt <= 0) continue;
        applied[inv.id] = amt;
        remaining = round2(remaining - amt);
      }
    }
    return { applied, unapplied: round2(Math.max(remaining, 0)) };
  }, [generalAmount, selectedAmounts, excludedIds, selectedCustomer]);

  function toggleInvoice(inv: UnpaidInvoice, checked: boolean) {
    if (checked) {
      if (excludedIds.has(inv.id)) {
        // Was covered by the cascade before the user unticked it -- just let it back in.
        setExcludedIds((prev) => {
          const next = new Set(prev);
          next.delete(inv.id);
          return next;
        });
      } else {
        setSelectedAmounts((prev) => ({ ...prev, [inv.id]: inv.due.toFixed(2) }));
      }
    } else if (inv.id in selectedAmounts) {
      setSelectedAmounts((prev) => {
        const next = { ...prev };
        delete next[inv.id];
        return next;
      });
    } else if (inv.id in autoFill.applied) {
      // Opt this invoice out of the cascade; its share of the general amount rolls
      // forward to the next unpaid invoice (or stays as advance) automatically.
      setExcludedIds((prev) => new Set(prev).add(inv.id));
    }
  }

  function setInvoiceAmount(inv: UnpaidInvoice, value: string) {
    if (!(inv.id in selectedAmounts) && inv.id in autoFill.applied) {
      // First edit of an auto-filled box: carve its old share back out of the general
      // amount pool so it isn't double-counted once this becomes a manual entry.
      const oldAuto = autoFill.applied[inv.id];
      setGeneralAmount(String(round2((Number(generalAmount) || 0) - oldAuto)));
    }
    setSelectedAmounts((prev) => ({ ...prev, [inv.id]: value }));
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
      ...Object.entries(autoFill.applied)
        .filter(([, amt]) => amt > 0)
        .map(([invoiceId, amount]) => ({ invoiceId, amount })),
      ...(autoFill.unapplied > 0 ? [{ amount: autoFill.unapplied }] : []),
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
                setExcludedIds(new Set());
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
                const manualAmt = selectedAmounts[inv.id];
                const autoAmt = autoFill.applied[inv.id];
                const isAuto = manualAmt === undefined && autoAmt !== undefined;
                const checked = manualAmt !== undefined || isAuto;
                const displayValue = manualAmt ?? (autoAmt !== undefined ? autoAmt.toFixed(2) : "");
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
                      background: isAuto ? "#fdf6e3" : checked ? "#eaf1ff" : "#fff",
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
                      <div style={{ color: "#667", fontSize: 12 }}>
                        due Rs. {money(inv.due)}
                        {isAuto && <span style={{ color: "#a16207" }}> · auto-applied from general amount</span>}
                      </div>
                    </div>
                    {checked && (
                      <input
                        type="number"
                        min="0.01"
                        max={inv.due}
                        step="0.01"
                        value={displayValue}
                        onChange={(e) => setInvoiceAmount(inv, e.target.value)}
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

          <div className="afs-form-field" style={{ marginBottom: 4 }}>
            <label>General amount (auto-applied to other unpaid invoices, oldest first; leftover becomes advance)</label>
            <input type="number" min="0" step="0.01" value={generalAmount} onChange={(e) => setGeneralAmount(e.target.value)} />
          </div>
          {Number(generalAmount) > 0 && (
            <div style={{ marginBottom: 12, fontSize: 12, color: "#667" }}>
              {Object.keys(autoFill.applied).length > 0 &&
                `Rs. ${money(round2(Number(generalAmount) - autoFill.unapplied))} auto-applied above. `}
              Rs. {money(autoFill.unapplied)} stays as advance.
            </div>
          )}

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
