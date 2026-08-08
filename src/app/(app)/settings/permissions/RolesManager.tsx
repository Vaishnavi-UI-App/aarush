"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PageKey, PagePermissionSet } from "@/lib/pages";
import { TrashIcon } from "@/components/icons";
import RoleForm from "./RoleForm";

export interface RoleSummary {
  id: string;
  name: string;
  isSystem: boolean;
  isOwner: boolean;
  userCount: number;
  permissions: Record<PageKey, PagePermissionSet>;
}

export default function RolesManager({ roles }: { roles: RoleSummary[] }) {
  const router = useRouter();
  const [mode, setMode] = useState<"list" | "new" | string>("list");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function closeForm() {
    setMode("list");
    router.refresh();
  }

  async function deleteRole(role: RoleSummary) {
    if (!window.confirm(`Delete role "${role.name}"?`)) return;
    setBusyId(role.id);
    setError(null);
    try {
      const res = await fetch(`/api/roles/${role.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to delete role");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete role");
    } finally {
      setBusyId(null);
    }
  }

  if (mode === "new") {
    return <RoleForm onSaved={closeForm} onCancel={() => setMode("list")} />;
  }

  const editingRole = roles.find((r) => r.id === mode);
  if (editingRole) {
    return (
      <RoleForm
        initial={{ id: editingRole.id, name: editingRole.name, permissions: editingRole.permissions }}
        onSaved={closeForm}
        onCancel={() => setMode("list")}
      />
    );
  }

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <button type="button" onClick={() => setMode("new")} className="afs-btn afs-btn-primary">
          + New Role
        </button>
      </div>

      {error && <div style={{ color: "#b91c1c", fontSize: 13, marginBottom: 12 }}>{error}</div>}

      <table className="afs-table">
        <thead>
          <tr>
            <th>Role</th>
            <th>Users</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {roles.map((role) => (
            <tr key={role.id}>
              <td data-label="Role">
                {role.name}
                {role.isOwner && (
                  <span className="afs-badge" style={{ marginLeft: 8, background: "#fff7e0", color: "#5c4a00" }}>
                    Full access
                  </span>
                )}
              </td>
              <td data-label="Users">{role.userCount}</td>
              <td>
                <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                  {!role.isOwner && (
                    <button type="button" onClick={() => setMode(role.id)} className="afs-btn" style={{ background: "#e5e7eb", color: "#333", padding: "4px 12px" }}>
                      Edit
                    </button>
                  )}
                  {!role.isSystem && (
                    <button
                      type="button"
                      onClick={() => deleteRole(role)}
                      disabled={busyId === role.id || role.userCount > 0}
                      title={role.userCount > 0 ? "Reassign users off this role first" : "Delete role"}
                      className="afs-icon-btn danger"
                    >
                      <TrashIcon />
                    </button>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
