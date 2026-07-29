"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function RecordVendorPaymentForm({ vendorId }: { vendorId: string }) {
  const router = useRouter();
  const [amount, setAmount] = useState("");
  const [mode, setMode] = useState("BANK_TRANSFER");
  const [referenceNo, setReferenceNo] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/vendors/${vendorId}/payments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: Number(amount), mode, referenceNo: referenceNo || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to record payment");
      setAmount("");
      setReferenceNo("");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to record payment");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={onSubmit}>
      <div className="afs-form-row">
        <div className="afs-form-field">
          <label>Amount *</label>
          <input required type="number" min="0.01" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />
        </div>
        <div className="afs-form-field">
          <label>Mode *</label>
          <select value={mode} onChange={(e) => setMode(e.target.value)}>
            {["CASH", "UPI", "BANK_TRANSFER", "CHEQUE", "OTHER"].map((m) => (
              <option key={m} value={m}>
                {m.replace("_", " ")}
              </option>
            ))}
          </select>
        </div>
        <div className="afs-form-field">
          <label>Reference no.</label>
          <input value={referenceNo} onChange={(e) => setReferenceNo(e.target.value)} />
        </div>
      </div>
      {error && <div style={{ color: "#b91c1c", fontSize: 13, marginBottom: 10 }}>{error}</div>}
      <button type="submit" disabled={saving} className="afs-btn afs-btn-maroon">
        {saving ? "Recording…" : "Record Payment"}
      </button>
    </form>
  );
}
