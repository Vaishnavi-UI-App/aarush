"use client";

import { useState } from "react";
import { PAGE_KEYS, PAGE_LABELS, PageKey, PagePermissionSet } from "@/lib/pages";

function emptyPermissions(): Record<PageKey, PagePermissionSet> {
  return Object.fromEntries(PAGE_KEYS.map((p) => [p, { canView: false, canAdd: false, canEdit: false, canDelete: false }])) as Record<
    PageKey,
    PagePermissionSet
  >;
}

export interface RoleFormRole {
  id: string;
  name: string;
  permissions: Record<PageKey, PagePermissionSet>;
}

export default function RoleForm({
  initial,
  onSaved,
  onCancel,
}: {
  initial?: RoleFormRole;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const isEdit = !!initial;
  const [name, setName] = useState(initial?.name ?? "");
  const [permissions, setPermissions] = useState<Record<PageKey, PagePermissionSet>>(initial?.permissions ?? emptyPermissions());
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function toggle(page: PageKey, action: keyof PagePermissionSet) {
    setPermissions((prev) => ({ ...prev, [page]: { ...prev[page], [action]: !prev[page][action] } }));
  }

  function toggleRow(page: PageKey, allOn: boolean) {
    setPermissions((prev) => ({
      ...prev,
      [page]: { canView: !allOn, canAdd: !allOn, canEdit: !allOn, canDelete: !allOn },
    }));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(isEdit ? `/api/roles/${initial!.id}` : "/api/roles", {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, permissions }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save role");
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save role");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={onSubmit}>
      <div className="afs-form-field" style={{ marginBottom: 20, maxWidth: 360 }}>
        <label>Role Name</label>
        <input required placeholder="e.g. Site Supervisor" value={name} onChange={(e) => setName(e.target.value)} />
      </div>

      <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 10 }}>Page Access</div>
      <table className="afs-table" style={{ marginBottom: 20 }}>
        <thead>
          <tr>
            <th>Page</th>
            <th style={{ textAlign: "center", width: 70 }}>View</th>
            <th style={{ textAlign: "center", width: 70 }}>Add</th>
            <th style={{ textAlign: "center", width: 70 }}>Edit</th>
            <th style={{ textAlign: "center", width: 70 }}>Delete</th>
          </tr>
        </thead>
        <tbody>
          {PAGE_KEYS.map((page) => {
            const cell = permissions[page];
            const allOn = cell.canView && cell.canAdd && cell.canEdit && cell.canDelete;
            return (
              <tr key={page}>
                <td data-label="Page">
                  <button
                    type="button"
                    onClick={() => toggleRow(page, allOn)}
                    title="Toggle all"
                    style={{ background: "none", border: "none", padding: 0, cursor: "pointer", font: "inherit", color: "inherit" }}
                  >
                    {PAGE_LABELS[page]}
                  </button>
                </td>
                {(["canView", "canAdd", "canEdit", "canDelete"] as const).map((action) => (
                  <td
                    key={action}
                    data-label={action === "canView" ? "View" : action === "canAdd" ? "Add" : action === "canEdit" ? "Edit" : "Delete"}
                    style={{ textAlign: "center" }}
                  >
                    <input type="checkbox" checked={cell[action]} onChange={() => toggle(page, action)} />
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>

      {error && <div style={{ color: "#b91c1c", fontSize: 13, marginBottom: 12 }}>{error}</div>}

      <div style={{ display: "flex", gap: 10 }}>
        <button type="submit" disabled={saving} className="afs-btn afs-btn-primary">
          {saving ? "Saving…" : "Save Role"}
        </button>
        <button type="button" onClick={onCancel} disabled={saving} className="afs-btn" style={{ background: "#e5e7eb", color: "#333" }}>
          Cancel
        </button>
      </div>
    </form>
  );
}
