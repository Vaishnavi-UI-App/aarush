"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PERMISSION_KEYS, PERMISSION_LABELS, PermissionKey, Role } from "@/lib/permission-keys";

const ROLES: Role[] = ["OWNER", "ACCOUNTANT", "SALES_STAFF", "AUDITOR"];

interface RoleRow {
  role: Role;
  permissions: { key: PermissionKey; allowed: boolean; isOverride: boolean }[];
}

export default function PermissionsMatrix({ matrix }: { matrix: RoleRow[] }) {
  const router = useRouter();
  const [busyCell, setBusyCell] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function cellFor(role: Role, key: PermissionKey) {
    const row = matrix.find((r) => r.role === role)!;
    return row.permissions.find((p) => p.key === key)!;
  }

  async function toggle(role: Role, key: PermissionKey, current: boolean) {
    if (role === "OWNER" && key === "canManageUsers") return; // locked, can't be toggled

    const cellId = `${role}:${key}`;
    setBusyCell(cellId);
    setError(null);
    try {
      const res = await fetch("/api/permissions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role, key, allowed: !current }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update permission");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to update permission");
    } finally {
      setBusyCell(null);
    }
  }

  async function resetToDefault(role: Role, key: PermissionKey) {
    const cellId = `${role}:${key}`;
    setBusyCell(cellId);
    setError(null);
    try {
      const res = await fetch("/api/permissions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role, key, allowed: null }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to reset permission");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to reset permission");
    } finally {
      setBusyCell(null);
    }
  }

  return (
    <div>
      {error && <div style={{ color: "#b91c1c", fontSize: 13, marginBottom: 12 }}>{error}</div>}
      <table className="afs-table">
        <thead>
          <tr>
            <th>Permission</th>
            {ROLES.map((role) => (
              <th key={role} style={{ textAlign: "center" }}>
                {role.replace("_", " ")}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {PERMISSION_KEYS.map((key) => (
            <tr key={key}>
              <td>{PERMISSION_LABELS[key]}</td>
              {ROLES.map((role) => {
                const cell = cellFor(role, key);
                const locked = role === "OWNER" && key === "canManageUsers";
                const cellId = `${role}:${key}`;
                return (
                  <td key={role} style={{ textAlign: "center" }}>
                    <input
                      type="checkbox"
                      checked={cell.allowed}
                      disabled={locked || busyCell === cellId}
                      title={locked ? "OWNER can't lose access to manage users" : undefined}
                      onChange={() => toggle(role, key, cell.allowed)}
                    />
                    {cell.isOverride && !locked && (
                      <button
                        type="button"
                        onClick={() => resetToDefault(role, key)}
                        disabled={busyCell === cellId}
                        title="Reset to default"
                        style={{ marginLeft: 6, fontSize: 11, background: "none", border: "none", color: "#6b7280", cursor: "pointer" }}
                      >
                        reset
                      </button>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
