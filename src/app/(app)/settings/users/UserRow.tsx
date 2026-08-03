"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const ROLES = ["OWNER", "ACCOUNTANT", "SALES_STAFF", "AUDITOR"] as const;

interface User {
  id: string;
  name: string | null;
  email: string;
  role: (typeof ROLES)[number];
  createdAt: string | Date;
}

export default function UserRow({ user, isSelf }: { user: User; isSelf: boolean }) {
  const router = useRouter();
  const [role, setRole] = useState(user.role);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  async function updateRole(newRole: (typeof ROLES)[number]) {
    setBusy(true);
    setNotice(null);
    const previous = role;
    setRole(newRole);
    try {
      const res = await fetch(`/api/users/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: newRole }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update role");
      router.refresh();
    } catch (e) {
      setRole(previous);
      setNotice(e instanceof Error ? e.message : "Failed to update role");
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
      <td>{user.name || "—"}</td>
      <td>{user.email}</td>
      <td>
        <select
          value={role}
          disabled={busy || isSelf}
          title={isSelf ? "You can't change your own role" : undefined}
          onChange={(e) => updateRole(e.target.value as (typeof ROLES)[number])}
        >
          {ROLES.map((r) => (
            <option key={r} value={r}>
              {r.replace("_", " ")}
            </option>
          ))}
        </select>
      </td>
      <td>{new Date(user.createdAt).toLocaleDateString("en-IN")}</td>
      <td style={{ fontSize: 12 }}>
        <button type="button" onClick={resendInvite} disabled={busy} className="afs-icon-btn" style={{ width: "auto", padding: "4px 10px" }}>
          Resend invite
        </button>
        {notice && <div style={{ marginTop: 4, color: "#374151" }}>{notice}</div>}
      </td>
    </tr>
  );
}
