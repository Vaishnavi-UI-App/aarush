"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function NewSiteForm() {
  const router = useRouter();
  const [form, setForm] = useState({ name: "", address: "" });
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
      const res = await fetch("/api/sites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create site");
      setForm({ name: "", address: "" });
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create site");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={onSubmit}>
      <div className="afs-form-row">
        <div className="afs-form-field">
          <label>Site name *</label>
          <input required value={form.name} onChange={(e) => set("name", e.target.value)} />
        </div>
        <div className="afs-form-field">
          <label>Address</label>
          <input value={form.address} onChange={(e) => set("address", e.target.value)} />
        </div>
      </div>
      {error && <div style={{ color: "#b91c1c", fontSize: 13, marginBottom: 10 }}>{error}</div>}
      <button type="submit" disabled={saving} className="afs-btn afs-btn-primary">
        {saving ? "Adding…" : "+ Add Site"}
      </button>
    </form>
  );
}
