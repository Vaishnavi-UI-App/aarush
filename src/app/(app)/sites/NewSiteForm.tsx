"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function NewSiteForm() {
  const router = useRouter();
  const [form, setForm] = useState({ name: "", address: "", pincode: "" });
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function set<K extends keyof typeof form>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch("/api/sites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create site");
      if (form.pincode && data.geocodeFailed) {
        setNotice("Site added, but that pincode couldn't be located on the map -- set its location manually from the site page.");
      } else if (form.pincode) {
        setNotice("Site added and located on the map from its pincode.");
      }
      setForm({ name: "", address: "", pincode: "" });
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
        <div className="afs-form-field">
          <label>Pincode</label>
          <input
            value={form.pincode}
            onChange={(e) => set("pincode", e.target.value)}
            placeholder="e.g. 411017"
            maxLength={10}
            title="Used to automatically place this site on the map"
          />
        </div>
      </div>
      {error && <div style={{ color: "#b91c1c", fontSize: 13, marginBottom: 10 }}>{error}</div>}
      {notice && !error && <div style={{ color: "#14532d", fontSize: 13, marginBottom: 10 }}>{notice}</div>}
      <button type="submit" disabled={saving} className="afs-btn afs-btn-primary">
        {saving ? "Adding…" : "+ Add Site"}
      </button>
    </form>
  );
}
