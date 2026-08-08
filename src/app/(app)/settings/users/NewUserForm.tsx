"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface RoleOption {
  id: string;
  name: string;
}

interface SiteOption {
  id: string;
  name: string;
}

export default function NewUserForm({ roles, sites }: { roles: RoleOption[]; sites: SiteOption[] }) {
  const router = useRouter();
  const [form, setForm] = useState({ name: "", email: "", roleId: roles[0]?.id ?? "", siteId: "" });
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
      setForm({ name: "", email: "", roleId: roles[0]?.id ?? "", siteId: "" });
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to add user");
    } finally {
      setSaving(false);
    }
  }

  if (roles.length === 0) {
    return <div className="afs-empty">Create a role first (Settings — Permissions) before adding a user.</div>;
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
          <select value={form.roleId} onChange={(e) => set("roleId", e.target.value)}>
            {roles.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        </div>
        <div className="afs-form-field">
          <label>Assigned site</label>
          <select value={form.siteId} onChange={(e) => set("siteId", e.target.value)}>
            <option value="">All sites (unrestricted)</option>
            {sites.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
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
