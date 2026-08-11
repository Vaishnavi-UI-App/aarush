"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircleIcon, EditIcon, MailIcon, TrashIcon, XCircleIcon } from "@/components/icons";

interface RoleOption {
  id: string;
  name: string;
}

interface SiteOption {
  id: string;
  name: string;
}

interface User {
  id: string;
  name: string | null;
  email: string;
  roleId: string | null;
  roleName: string;
  siteId: string | null;
  createdAt: string | Date;
  monthlySalary: number | null;
}

export default function UserRow({ user, roles, sites, isSelf }: { user: User; roles: RoleOption[]; sites: SiteOption[]; isSelf: boolean }) {
  const router = useRouter();
  const [roleId, setRoleId] = useState(user.roleId ?? "");
  const [siteId, setSiteId] = useState(user.siteId ?? "");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [editingName, setEditingName] = useState(false);
  const [name, setName] = useState(user.name ?? "");
  const [editingSalary, setEditingSalary] = useState(false);
  const [salary, setSalary] = useState(user.monthlySalary != null ? String(user.monthlySalary) : "");

  async function update(next: { roleId?: string; siteId?: string; name?: string; monthlySalary?: string }) {
    setBusy(true);
    setNotice(null);
    const previousRoleId = roleId;
    const previousSiteId = siteId;
    const previousName = name;
    const previousSalary = salary;
    if (next.roleId !== undefined) setRoleId(next.roleId);
    if (next.siteId !== undefined) setSiteId(next.siteId);
    if (next.name !== undefined) setName(next.name);
    if (next.monthlySalary !== undefined) setSalary(next.monthlySalary);
    try {
      const salaryValue = next.monthlySalary ?? salary;
      const res = await fetch(`/api/users/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roleId: next.roleId ?? roleId,
          siteId: (next.siteId ?? siteId) || null,
          name: next.name ?? name,
          monthlySalary: salaryValue.trim() ? Number(salaryValue) : null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update user");
      setEditingName(false);
      setEditingSalary(false);
      router.refresh();
    } catch (e) {
      setRoleId(previousRoleId);
      setSiteId(previousSiteId);
      setName(previousName);
      setSalary(previousSalary);
      setNotice(e instanceof Error ? e.message : "Failed to update user");
    } finally {
      setBusy(false);
    }
  }

  async function resendInvite() {
    setBusy(true);
    setNotice(null);
    try {
      const res = await fetch(`/api/users/${user.id}/resend-invite`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setNotice(data.password ? `Email failed -- share this password manually: ${data.password}` : data.error || "Failed to send email");
        return;
      }
      setNotice("New login details emailed.");
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Failed to send email");
    } finally {
      setBusy(false);
    }
  }

  async function deactivate() {
    if (!window.confirm(`Deactivate ${user.name || user.email}? They won't be able to log in until reactivated.`)) return;
    setBusy(true);
    setNotice(null);
    try {
      const res = await fetch(`/api/users/${user.id}/archive`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to deactivate user");
      router.refresh();
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Failed to deactivate user");
    } finally {
      setBusy(false);
    }
  }

  return (
    <tr>
      <td data-label="Name">
        {editingName ? (
          <input value={name} onChange={(e) => setName(e.target.value)} disabled={busy} autoFocus style={{ minWidth: 120 }} />
        ) : (
          user.name || "—"
        )}
      </td>
      <td data-label="Email">{user.email}</td>
      <td data-label="Role">
        <select
          value={roleId}
          disabled={busy || isSelf}
          title={isSelf ? "You can't change your own role" : undefined}
          onChange={(e) => update({ roleId: e.target.value })}
        >
          {roles.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </select>
      </td>
      <td data-label="Site">
        <select value={siteId} disabled={busy} onChange={(e) => update({ siteId: e.target.value })}>
          <option value="">All sites</option>
          {sites.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </td>
      <td data-label="Monthly Salary">
        {editingSalary ? (
          <input
            type="number"
            min="0"
            step="0.01"
            value={salary}
            onChange={(e) => setSalary(e.target.value)}
            disabled={busy}
            autoFocus
            style={{ width: 100 }}
            placeholder="Rs."
          />
        ) : user.monthlySalary != null ? (
          `Rs. ${user.monthlySalary.toLocaleString("en-IN")}`
        ) : (
          <span style={{ color: "#aab" }}>—</span>
        )}
      </td>
      <td data-label="Added">{new Date(user.createdAt).toLocaleDateString("en-IN")}</td>
      <td style={{ fontSize: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button type="button" onClick={resendInvite} disabled={busy} title="Resend invite" className="afs-icon-btn invite">
            <MailIcon />
          </button>
          {editingName ? (
            <>
              <button type="button" onClick={() => update({ name })} disabled={busy} title="Save name" className="afs-icon-btn success">
                <CheckCircleIcon />
              </button>
              <button
                type="button"
                onClick={() => {
                  setName(user.name ?? "");
                  setEditingName(false);
                }}
                disabled={busy}
                title="Cancel"
                className="afs-icon-btn"
              >
                <XCircleIcon />
              </button>
            </>
          ) : (
            <button type="button" onClick={() => setEditingName(true)} disabled={busy} title="Edit name" className="afs-icon-btn edit">
              <EditIcon />
            </button>
          )}
          {editingSalary ? (
            <>
              <button type="button" onClick={() => update({ monthlySalary: salary })} disabled={busy} title="Save salary" className="afs-icon-btn success">
                <CheckCircleIcon />
              </button>
              <button
                type="button"
                onClick={() => {
                  setSalary(user.monthlySalary != null ? String(user.monthlySalary) : "");
                  setEditingSalary(false);
                }}
                disabled={busy}
                title="Cancel"
                className="afs-icon-btn"
              >
                <XCircleIcon />
              </button>
            </>
          ) : (
            <button type="button" onClick={() => setEditingSalary(true)} disabled={busy} title="Edit monthly salary" className="afs-icon-btn edit" style={{ fontSize: 13, fontWeight: 700 }}>
              ₹
            </button>
          )}
          {!isSelf && (
            <button type="button" onClick={deactivate} disabled={busy} title="Deactivate user" className="afs-icon-btn danger">
              <TrashIcon />
            </button>
          )}
        </div>
        {notice && <div style={{ marginTop: 4, color: "#374151" }}>{notice}</div>}
      </td>
    </tr>
  );
}
