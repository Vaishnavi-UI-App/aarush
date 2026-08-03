"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const ROLES = ["ACCOUNTANT", "SALES_STAFF", "AUDITOR", "OWNER"] as const;

export default function NewUserForm() {
  const router = useRouter();
  const [form, setForm] = useState({ name: "", email: "", role: "SALES_STAFF" as (typeof ROLES)[number] });
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to add user");
      setNotice(
        data.emailed
          ? `Login details sent to ${form.email}.`
          : `User created, but the email failed to send. Share these manually: email ${form.email}, password ${data.password} -- or use "Resend invite" below once the email issue is fixed.`
      );
      setForm({ name: "", email: "", role: "SALES_STAFF" });
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to add user");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={onSubmit}>
      <div className="afs-form-row">
        <div className="afs-form-field">
          <label>Name</label>
          <input value={form.name} onChange={(e) => set("name", e.target.value)} />
        </div>
        <div className="afs-form-field">
          <label>Email *</label>
          <input type="email" required value={form.email} onChange={(e) => set("email", e.target.value)} />
        </div>
        <div className="afs-form-field">
          <label>Role *</label>
          <select value={form.role} onChange={(e) => set("role", e.target.value as (typeof ROLES)[number])}>
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {r.replace("_", " ")}
              </option>
            ))}
          </select>
        </div>
      </div>
      {error && <div style={{ color: "#b91c1c", fontSize: 13, marginBottom: 10 }}>{error}</div>}
      {notice && <div style={{ color: "#0ca30c", fontSize: 13, marginBottom: 10 }}>{notice}</div>}
      <button type="submit" disabled={saving} className="afs-btn afs-btn-primary">
        {saving ? "Adding…" : "+ Add User"}
      </button>
    </form>
  );
}
