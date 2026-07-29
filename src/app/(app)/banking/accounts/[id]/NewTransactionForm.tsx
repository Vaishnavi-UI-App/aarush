"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function NewTransactionForm({ bankAccountId }: { bankAccountId: string }) {
  const router = useRouter();
  const today = new Date().toISOString().slice(0, 10);
  const [form, setForm] = useState({ date: today, description: "", amount: "", type: "CREDIT" });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function set<K extends keyof typeof form>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/bank-accounts/${bankAccountId}/transactions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, amount: Number(form.amount) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to add transaction");
      setForm({ date: today, description: "", amount: "", type: "CREDIT" });
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to add transaction");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={onSubmit}>
      <div className="afs-form-row">
        <div className="afs-form-field">
          <label>Date *</label>
          <input required type="date" value={form.date} onChange={(e) => set("date", e.target.value)} />
        </div>
        <div className="afs-form-field" style={{ flex: 2 }}>
          <label>Description *</label>
          <input required value={form.description} onChange={(e) => set("description", e.target.value)} />
        </div>
        <div className="afs-form-field">
          <label>Amount *</label>
          <input required type="number" min="0.01" step="0.01" value={form.amount} onChange={(e) => set("amount", e.target.value)} />
        </div>
        <div className="afs-form-field">
          <label>Type *</label>
          <select value={form.type} onChange={(e) => set("type", e.target.value)}>
            <option value="CREDIT">Credit (money in)</option>
            <option value="DEBIT">Debit (money out)</option>
          </select>
        </div>
      </div>
      {error && <div style={{ color: "#b91c1c", fontSize: 13, marginBottom: 10 }}>{error}</div>}
      <button type="submit" disabled={saving} className="afs-btn afs-btn-primary">
        {saving ? "Adding…" : "+ Add Transaction"}
      </button>
    </form>
  );
}
