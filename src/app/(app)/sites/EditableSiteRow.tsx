"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { EditIcon, TrashIcon } from "@/components/icons";

interface Site {
  id: string;
  name: string;
  address: string | null;
  companyBalance: number;
  pending: number;
}

export default function EditableSiteRow({ site, canEdit, canDelete }: { site: Site; canEdit: boolean; canDelete: boolean }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ name: site.name, address: site.address ?? "" });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState(false);

  function set<K extends keyof typeof form>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function cancel() {
    setForm({ name: site.name, address: site.address ?? "" });
    setError(null);
    setEditing(false);
  }

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/sites/${site.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save site");
      setEditing(false);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save site");
    } finally {
      setSaving(false);
    }
  }

  async function deleteSite() {
    if (!window.confirm(`Delete "${site.name}"? Its fund/expense history stays exactly as it is -- this only hides it from site pickers.`)) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/sites/${site.id}/archive`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to delete site");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete site");
    } finally {
      setBusy(false);
    }
  }

  if (editing) {
    return (
      <tr>
        <td data-label="Site">
          <input value={form.name} onChange={(e) => set("name", e.target.value)} />
        </td>
        <td data-label="Address">
          <input value={form.address} onChange={(e) => set("address", e.target.value)} />
        </td>
        <td data-label="Company balance">Rs. {site.companyBalance.toFixed(2)}</td>
        <td data-label="Pending reimbursement">{site.pending > 0 ? `Rs. ${site.pending.toFixed(2)}` : "—"}</td>
        <td>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <button type="button" onClick={save} disabled={saving} className="afs-btn afs-btn-primary" style={{ padding: "4px 10px", fontSize: 12 }}>
              {saving ? "Saving…" : "Save"}
            </button>
            <button type="button" onClick={cancel} disabled={saving} className="afs-btn" style={{ padding: "4px 10px", fontSize: 12, background: "#e5e7eb", color: "#333" }}>
              Cancel
            </button>
            {error && <span style={{ color: "#b91c1c", fontSize: 11 }}>{error}</span>}
          </div>
        </td>
      </tr>
    );
  }

  return (
    <tr>
      <td data-label="Site">
        <Link href={`/sites/${site.id}`}>{site.name}</Link>
      </td>
      <td data-label="Address">{site.address || "—"}</td>
      <td data-label="Company balance">Rs. {site.companyBalance.toFixed(2)}</td>
      <td data-label="Pending reimbursement">{site.pending > 0 ? `Rs. ${site.pending.toFixed(2)}` : "—"}</td>
      <td>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {canEdit && (
            <button type="button" onClick={() => setEditing(true)} title="Edit site" className="afs-icon-btn edit">
              <EditIcon />
            </button>
          )}
          {canDelete && (
            <button type="button" onClick={deleteSite} disabled={busy} title="Delete site" className="afs-icon-btn danger">
              <TrashIcon />
            </button>
          )}
          {error && <span style={{ color: "#b91c1c", fontSize: 11 }}>{error}</span>}
        </div>
      </td>
    </tr>
  );
}
