"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function FundSiteForm({ siteId }: { siteId: string }) {
  const router = useRouter();
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch(`/api/sites/${siteId}/fund`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: Number(amount), note: note || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to add funds");
      setNotice(
        Number(data.reimbursedToPersonal) > 0
          ? `Rs. ${Number(data.reimbursedToPersonal).toFixed(2)} cleared pending reimbursement, Rs. ${Number(data.addedToBalance).toFixed(2)} added to balance.`
          : `Rs. ${Number(data.addedToBalance).toFixed(2)} added to balance.`
      );
      setAmount("");
      setNote("");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to add funds");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={onSubmit} style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end" }}>
      <div className="afs-form-field" style={{ maxWidth: 160 }}>
        <label>Amount *</label>
        <input required type="number" min="0.01" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />
      </div>
      <div className="afs-form-field" style={{ flex: "1 1 220px" }}>
        <label>Note</label>
        <input value={note} onChange={(e) => setNote(e.target.value)} />
      </div>
      <button type="submit" disabled={saving} className="afs-btn afs-btn-primary">
        {saving ? "Adding…" : "Add Company Funds"}
      </button>
      {error && <span style={{ color: "#b91c1c", fontSize: 13 }}>{error}</span>}
      {notice && <span style={{ color: "#0ca30c", fontSize: 13 }}>{notice}</span>}
    </form>
  );
}
