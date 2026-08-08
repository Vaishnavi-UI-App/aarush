"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Option {
  id: string;
  name: string;
}

export default function FundCompanyForm({ sites }: { sites: Option[] }) {
  const router = useRouter();
  const [siteId, setSiteId] = useState(sites[0]?.id ?? "");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!siteId) {
      setError("Choose a site");
      return;
    }
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

  if (sites.length === 0) return null;

  return (
    <form onSubmit={onSubmit}>
      <div className="afs-form-field" style={{ marginBottom: 12 }}>
        <label>Site *</label>
        <select required value={siteId} onChange={(e) => setSiteId(e.target.value)}>
          {sites.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </div>
      <div className="afs-form-field" style={{ marginBottom: 12 }}>
        <label>Amount *</label>
        <input required type="number" min="0.01" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />
      </div>
      <div className="afs-form-field" style={{ marginBottom: 16 }}>
        <label>Note</label>
        <input value={note} onChange={(e) => setNote(e.target.value)} />
      </div>
      {error && <div style={{ color: "#b91c1c", fontSize: 13, marginBottom: 12 }}>{error}</div>}
      {notice && <div style={{ color: "#0ca30c", fontSize: 13, marginBottom: 12 }}>{notice}</div>}
      <button type="submit" disabled={saving} className="afs-btn afs-btn-primary">
        {saving ? "Adding…" : "Add Company Funds"}
      </button>
    </form>
  );
}
