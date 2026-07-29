"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function NewBankAccountForm() {
  const router = useRouter();
  const [form, setForm] = useState({ bankName: "", accountNo: "", ifsc: "", branchName: "", openingBalance: "0" });
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
      const res = await fetch("/api/bank-accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, openingBalance: Number(form.openingBalance) || 0 }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to add bank account");
      setForm({ bankName: "", accountNo: "", ifsc: "", branchName: "", openingBalance: "0" });
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to add bank account");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={onSubmit}>
      <div className="afs-form-row">
        <div className="afs-form-field">
          <label>Bank name *</label>
          <input required value={form.bankName} onChange={(e) => set("bankName", e.target.value)} />
        </div>
        <div className="afs-form-field">
          <label>Account no. *</label>
          <input required value={form.accountNo} onChange={(e) => set("accountNo", e.target.value)} />
        </div>
        <div className="afs-form-field">
          <label>IFSC *</label>
          <input required value={form.ifsc} onChange={(e) => set("ifsc", e.target.value)} />
        </div>
        <div className="afs-form-field">
          <label>Branch</label>
          <input value={form.branchName} onChange={(e) => set("branchName", e.target.value)} />
        </div>
        <div className="afs-form-field">
          <label>Opening balance</label>
          <input type="number" step="0.01" value={form.openingBalance} onChange={(e) => set("openingBalance", e.target.value)} />
        </div>
      </div>
      {error && <div style={{ color: "#b91c1c", fontSize: 13, marginBottom: 10 }}>{error}</div>}
      <button type="submit" disabled={saving} className="afs-btn afs-btn-primary">
        {saving ? "Adding…" : "+ Add Bank Account"}
      </button>
    </form>
  );
}
