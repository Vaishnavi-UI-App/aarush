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

interface User {
  id: string;
  name: string | null;
  email: string;
  roleId: string | null;
  roleName: string;
  siteId: string | null;
  createdAt: string | Date;
}

export default function UserRow({ user, roles, sites, isSelf }: { user: User; roles: RoleOption[]; sites: SiteOption[]; isSelf: boolean }) {
  const router = useRouter();
  const [roleId, setRoleId] = useState(user.roleId ?? "");
  const [siteId, setSiteId] = useState(user.siteId ?? "");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  async function update(next: { roleId?: string; siteId?: string }) {
    setBusy(true);
    setNotice(null);
    const previousRoleId = roleId;
    const previousSiteId = siteId;
    if (next.roleId !== undefined) setRoleId(next.roleId);
    if (next.siteId !== undefined) setSiteId(next.siteId);
    try {
      const res = await fetch(`/api/users/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roleId: next.roleId ?? roleId,
          siteId: (next.siteId ?? siteId) || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update user");
      router.refresh();
    } catch (e) {
      setRoleId(previousRoleId);
      setSiteId(previousSiteId);
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

  return (
    <tr>
      <td data-label="Name">{user.name || "—"}</td>
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
      <td data-label="Added">{new Date(user.createdAt).toLocaleDateString("en-IN")}</td>
      <td style={{ fontSize: 12 }}>
        <button type="button" onClick={resendInvite} disabled={busy} className="afs-icon-btn" style={{ width: "auto", padding: "4px 10px" }}>
          Resend invite
        </button>
        {notice && <div style={{ marginTop: 4, color: "#374151" }}>{notice}</div>}
      </td>
    </tr>
  );
}
