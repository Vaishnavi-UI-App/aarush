"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { EditIcon, TrashIcon } from "@/components/icons";

interface Vendor {
  id: string;
  name: string;
  gstin: string | null;
  stateCode: string;
  phone: string | null;
  email: string | null;
  address: string | null;
}

export default function EditableVendorRow({ vendor, canEdit, canDelete }: { vendor: Vendor; canEdit: boolean; canDelete: boolean }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    name: vendor.name,
    gstin: vendor.gstin ?? "",
    stateCode: vendor.stateCode,
    phone: vendor.phone ?? "",
    email: vendor.email ?? "",
    address: vendor.address ?? "",
  });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState(false);

  function set<K extends keyof typeof form>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function cancel() {
    setForm({
      name: vendor.name,
      gstin: vendor.gstin ?? "",
      stateCode: vendor.stateCode,
      phone: vendor.phone ?? "",
      email: vendor.email ?? "",
      address: vendor.address ?? "",
    });
    setError(null);
    setEditing(false);
  }

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/vendors/${vendor.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save vendor");
      setEditing(false);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save vendor");
    } finally {
      setSaving(false);
    }
  }

  async function deleteVendor() {
    if (!window.confirm(`Delete "${vendor.name}"? Their existing purchases and ledger history stay exactly as they are -- this only hides them from vendor pickers.`)) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/vendors/${vendor.id}/archive`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to delete vendor");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete vendor");
    } finally {
      setBusy(false);
    }
  }

  if (editing) {
    return (
      <tr>
        <td data-label="Name">
          <input value={form.name} onChange={(e) => set("name", e.target.value)} />
        </td>
        <td data-label="GSTIN">
          <input value={form.gstin} onChange={(e) => set("gstin", e.target.value)} />
        </td>
        <td data-label="State code">
          <input value={form.stateCode} onChange={(e) => set("stateCode", e.target.value)} maxLength={2} />
        </td>
        <td data-label="Phone">
          <input value={form.phone} onChange={(e) => set("phone", e.target.value)} />
        </td>
        <td data-label="Email">
          <input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} />
        </td>
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
      <td data-label="Name">
        <a href={`/vendors/${vendor.id}`}>{vendor.name}</a>
      </td>
      <td data-label="GSTIN">{vendor.gstin ?? "—"}</td>
      <td data-label="State code">{vendor.stateCode}</td>
      <td data-label="Phone">{vendor.phone ?? "—"}</td>
      <td data-label="Email">{vendor.email ?? "—"}</td>
      <td>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {canEdit && (
            <button type="button" onClick={() => setEditing(true)} title="Edit vendor" className="afs-icon-btn edit">
              <EditIcon />
            </button>
          )}
          {canDelete && (
            <button type="button" onClick={deleteVendor} disabled={busy} title="Delete vendor" className="afs-icon-btn danger">
              <TrashIcon />
            </button>
          )}
          {error && <span style={{ color: "#b91c1c", fontSize: 11 }}>{error}</span>}
        </div>
      </td>
    </tr>
  );
}
