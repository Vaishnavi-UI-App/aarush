"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

interface UnpaidInvoice {
  id: string;
  number: string;
  total: number;
  paid: number;
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
  // The one amount the customer actually handed over. Invoices draw from this single
  // pool -- ticking one can never add money beyond what was received.
  const [amount, setAmount] = useState("");
  // Amounts the user typed themselves, overriding the oldest-first default for that
  // invoice (e.g. a partial payment, or picking a later invoice out of order).
  const [manualAmounts, setManualAmounts] = useState<Record<string, string>>({});
  // Invoices the oldest-first cascade would otherwise cover, but the user unticked --
  // their share flows to the next invoice in line instead.
  const [excludedIds, setExcludedIds] = useState<Set<string>>(new Set());
  const [mode, setMode] = useState("CASH");
  const [referenceNo, setReferenceNo] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const selectedCustomer = customers.find((c) => c.id === customerId);

  // Invoices you pick yourself -- by ticking one directly or typing into its box --
  // get first claim on the amount above, in invoice order; whatever's left over then
  // auto-cascades oldest-first through the rest. That priority is what lets you tick
  // a later, smaller invoice and have it actually take the money: it doesn't wait for
  // the auto-cascade to free up room on its own, it takes priority and the auto pass
  // simply has less left to work with. `availableBefore` records the budget at each
  // invoice's turn in its own pass, which caps manual edits (against other manual
  // picks) and decides whether an untouched invoice can still be ticked at all
  // (against every manual pick, since those always win first).
  const allocation = useMemo(() => {
    const totalAmount = Number(amount) || 0;
    const applied: Record<string, number> = {};
    const availableBefore: Record<string, number> = {};

    if (selectedCustomer) {
      let remaining = totalAmount;
      for (const inv of selectedCustomer.unpaidInvoices) {
        if (!(inv.id in manualAmounts)) continue;
        availableBefore[inv.id] = remaining;
        const amt = round2(Math.min(Number(manualAmounts[inv.id]) || 0, inv.due, remaining));
        if (amt > 0) {
          applied[inv.id] = amt;
          remaining = round2(remaining - amt);
        }
      }
      // What every existing manual pick left behind -- the most a brand-new manual
      // pick could ever claim, since manual picks always process before the cascade.
      const afterManual = remaining;
      for (const inv of selectedCustomer.unpaidInvoices) {
        if (inv.id in manualAmounts) continue;
        availableBefore[inv.id] = remaining;
        if (excludedIds.has(inv.id) || remaining <= 0) continue;
        const amt = round2(Math.min(remaining, inv.due));
        if (amt > 0) {
          applied[inv.id] = amt;
          remaining = round2(remaining - amt);
        }
      }
      return { applied, availableBefore, afterManual, unapplied: round2(Math.max(remaining, 0)) };
    }
    return { applied, availableBefore, afterManual: totalAmount, unapplied: round2(Math.max(totalAmount, 0)) };
  }, [amount, manualAmounts, excludedIds, selectedCustomer]);

  function toggleInvoice(inv: UnpaidInvoice, checked: boolean) {
    if (checked) {
      // Ticking an invoice always pins it as a manual pick, taking priority over the
      // auto-cascade -- even one the auto-cascade had no room left for. Default to
      // its due capped at what every other manual pick has left behind, so the box
      // shows what will actually be applied rather than an amount that gets silently
      // clamped down once the auto-cascade sees it.
      setExcludedIds((prev) => {
        const next = new Set(prev);
        next.delete(inv.id);
        return next;
      });
      const ceiling = round2(Math.min(inv.due, allocation.afterManual));
      setManualAmounts((prev) => ({ ...prev, [inv.id]: Math.max(ceiling, 0).toFixed(2) }));
    } else {
      setExcludedIds((prev) => new Set(prev).add(inv.id));
      setManualAmounts((prev) => {
        const next = { ...prev };
        delete next[inv.id];
        return next;
      });
    }
  }

  function setInvoiceAmount(inv: UnpaidInvoice, value: string) {
    if (value === "") {
      setManualAmounts((prev) => ({ ...prev, [inv.id]: "" }));
      return;
    }
    const budget = round2(Math.min(inv.due, allocation.availableBefore[inv.id] + (allocation.applied[inv.id] ?? 0)));
    const clamped = Math.min(Math.max(Number(value) || 0, 0), budget);
    setManualAmounts((prev) => ({ ...prev, [inv.id]: String(clamped) }));
  }

  const total = Number(amount) || 0;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const allocations = [
      ...Object.entries(allocation.applied)
        .filter(([, amt]) => amt > 0)
        .map(([invoiceId, amt]) => ({ invoiceId, amount: amt })),
      ...(allocation.unapplied > 0 ? [{ amount: allocation.unapplied }] : []),
    ];
    if (allocations.length === 0) {
      setError("Enter the amount received.");
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
                setAmount("");
                setManualAmounts({});
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

          <div className="afs-form-field" style={{ marginBottom: 12 }}>
            <label>Amount received *</label>
            <input required type="number" min="0.01" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </div>

          <div className="afs-form-field" style={{ marginBottom: 4 }}>
            <label>Apply to invoices (auto-applied oldest-first; untick to skip one, or edit the amount to split/partial-pay)</label>
          </div>
          {selectedCustomer && selectedCustomer.unpaidInvoices.length > 0 ? (
            <div style={{ marginBottom: 12, display: "flex", flexDirection: "column", gap: 6 }}>
              {selectedCustomer.unpaidInvoices.map((inv) => {
                const manualVal = manualAmounts[inv.id];
                const appliedAmt = allocation.applied[inv.id];
                const isManual = manualVal !== undefined;
                // A manual edit keeps the row checked (and its box mounted) even while the
                // typed value is momentarily blank or zero -- otherwise clearing the field to
                // retype a new amount would uncheck the invoice out from under the user.
                const checked = isManual || (appliedAmt !== undefined && appliedAmt > 0);
                // Only truly unreachable once every existing manual pick has already
                // claimed the whole amount -- ticking this one would still get nothing,
                // since manual picks can't take from each other. Anything the auto-cascade
                // merely hasn't gotten to yet stays tickable: ticking it pins it with
                // priority and the cascade simply has less left for the rest.
                const disabled = !checked && allocation.afterManual <= 0;
                const displayValue = manualVal ?? (appliedAmt !== undefined ? appliedAmt.toFixed(2) : "");
                const maxForInvoice = round2(Math.min(inv.due, allocation.availableBefore[inv.id] + (appliedAmt ?? 0)));
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
                      background: disabled ? "#f4f4f6" : isManual ? "#eaf1ff" : checked ? "#fdf6e3" : "#fff",
                      opacity: disabled ? 0.6 : 1,
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={disabled}
                      onChange={(e) => toggleInvoice(inv, e.target.checked)}
                      style={{ width: 18, height: 18, flexShrink: 0 }}
                    />
                    <div style={{ flex: 1, minWidth: 0, fontSize: 13 }}>
                      <div style={{ fontWeight: 600 }}>{inv.number}</div>
                      <div style={{ color: "#667", fontSize: 12 }}>
                        {inv.paid > 0 ? (
                          <>
                            Total Rs. {money(inv.total)} · Rs. {money(inv.paid)} already paid · due Rs. {money(inv.due)}
                          </>
                        ) : (
                          <>due Rs. {money(inv.due)}</>
                        )}
                        {checked && !isManual && <span style={{ color: "#a16207" }}> · auto-applied</span>}
                        {disabled && <span> · no amount left to apply</span>}
                      </div>
                    </div>
                    {checked && (
                      <input
                        type="number"
                        min="0.01"
                        max={maxForInvoice}
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

          {Number(amount) > 0 && (
            <div style={{ marginBottom: 12, fontSize: 12, color: "#667" }}>
              Rs. {money(round2(Number(amount) - allocation.unapplied))} applied above. Rs. {money(allocation.unapplied)} stays as advance.
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
