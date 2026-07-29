"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function NewVendorForm() {
  const router = useRouter();
  const [form, setForm] = useState({ name: "", gstin: "", stateCode: "", phone: "", email: "", address: "" });
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
      const res = await fetch("/api/vendors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create vendor");
      setForm({ name: "", gstin: "", stateCode: "", phone: "", email: "", address: "" });
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create vendor");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={onSubmit}>
      <div className="afs-form-row">
        <div className="afs-form-field">
          <label>Name *</label>
          <input required value={form.name} onChange={(e) => set("name", e.target.value)} />
        </div>
        <div className="afs-form-field">
          <label>State code * (e.g. 27)</label>
          <input required value={form.stateCode} onChange={(e) => set("stateCode", e.target.value)} maxLength={2} />
        </div>
        <div className="afs-form-field">
          <label>GSTIN</label>
          <input value={form.gstin} onChange={(e) => set("gstin", e.target.value)} />
        </div>
      </div>
      <div className="afs-form-row">
        <div className="afs-form-field">
          <label>Phone</label>
          <input value={form.phone} onChange={(e) => set("phone", e.target.value)} />
        </div>
        <div className="afs-form-field">
          <label>Email</label>
          <input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} />
        </div>
        <div className="afs-form-field">
          <label>Address</label>
          <input value={form.address} onChange={(e) => set("address", e.target.value)} />
        </div>
      </div>
      {error && <div style={{ color: "#b91c1c", fontSize: 13, marginBottom: 10 }}>{error}</div>}
      <button type="submit" disabled={saving} className="afs-btn afs-btn-primary">
        {saving ? "Adding…" : "+ Add Vendor"}
      </button>
    </form>
  );
}
