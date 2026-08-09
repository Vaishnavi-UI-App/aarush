"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { COMMON_UNITS } from "@/lib/units";

export default function NewItemForm() {
  const router = useRouter();
  const [form, setForm] = useState({ name: "", description: "", hsnCode: "", unit: "NOS", salePrice: "", taxRate: "18" });
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
      const res = await fetch("/api/items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          salePrice: Number(form.salePrice),
          taxRate: Number(form.taxRate),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create item");
      setForm({ name: "", description: "", hsnCode: "", unit: "NOS", salePrice: "", taxRate: "18" });
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create item");
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
          <label>Description</label>
          <input value={form.description} onChange={(e) => set("description", e.target.value)} placeholder="Optional spec/detail shown under the name on invoices" />
        </div>
        <div className="afs-form-field">
          <label>HSN/SAC *</label>
          <input required value={form.hsnCode} onChange={(e) => set("hsnCode", e.target.value)} />
        </div>
        <div className="afs-form-field">
          <label>Unit *</label>
          <select required value={form.unit} onChange={(e) => set("unit", e.target.value)}>
            {COMMON_UNITS.map((u) => (
              <option key={u} value={u}>
                {u}
              </option>
            ))}
          </select>
        </div>
        <div className="afs-form-field">
          <label>Sale price *</label>
          <input required type="number" step="0.01" min="0" value={form.salePrice} onChange={(e) => set("salePrice", e.target.value)} />
        </div>
        <div className="afs-form-field">
          <label>Tax rate % *</label>
          <select required value={form.taxRate} onChange={(e) => set("taxRate", e.target.value)}>
            {[0, 5, 12, 18, 28].map((r) => (
              <option key={r} value={r}>
                {r}%
              </option>
            ))}
          </select>
        </div>
      </div>
      {error && <div style={{ color: "#b91c1c", fontSize: 13, marginBottom: 10 }}>{error}</div>}
      <button type="submit" disabled={saving} className="afs-btn afs-btn-primary">
        {saving ? "Adding…" : "+ Add Item"}
      </button>
    </form>
  );
}
