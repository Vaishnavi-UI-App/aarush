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

interface EmployeeUser {
  id: string;
  name: string | null;
  email: string;
  phone: string | null;
  photoData: string | null;
  roleId: string | null;
  siteId: string | null;
  aadharNumber: string | null;
  panNumber: string | null;
  bankAccountName: string | null;
  bankAccountNo: string | null;
  bankIfsc: string | null;
  bankName: string | null;
  monthlySalary: number | null;
  createdAt: string;
}

export default function EmployeeProfileForm({
  user,
  roles,
  sites,
  isSelf,
}: {
  user: EmployeeUser;
  roles: RoleOption[];
  sites: SiteOption[];
  isSelf: boolean;
}) {
  const router = useRouter();
  const [name, setName] = useState(user.name ?? "");
  const [roleId, setRoleId] = useState(user.roleId ?? "");
  const [siteId, setSiteId] = useState(user.siteId ?? "");
  const [salary, setSalary] = useState(user.monthlySalary != null ? String(user.monthlySalary) : "");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ kind: "success" | "error"; text: string } | null>(null);

  const initials = (name || user.email)
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("") || "?";

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/users/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          roleId,
          siteId: siteId || null,
          monthlySalary: salary.trim() ? Number(salary) : null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save");
      setMessage({ kind: "success", text: "Saved." });
      router.refresh();
    } catch (e) {
      setMessage({ kind: "error", text: e instanceof Error ? e.message : "Failed to save" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="afs-card" style={{ marginTop: 20 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 24 }}>
        {user.photoData ? (
          <img src={user.photoData} alt="" style={{ width: 64, height: 64, borderRadius: "50%", objectFit: "cover" }} />
        ) : (
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: "50%",
              background: "#14213d",
              color: "#fff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 22,
              fontWeight: 700,
            }}
          >
            {initials}
          </div>
        )}
        <div>
          <div style={{ fontSize: 13, color: "#667" }}>{user.email}</div>
          <div style={{ fontSize: 13, color: "#667" }}>{user.phone || "No phone on file"}</div>
          <div style={{ fontSize: 12, color: "#889" }}>Added {new Date(user.createdAt).toLocaleDateString("en-IN")}</div>
        </div>
      </div>

      <form onSubmit={save}>
        <div className="afs-form-row">
          <div className="afs-form-field">
            <label>Name</label>
            <input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="afs-form-field">
            <label>Role</label>
            <select value={roleId} disabled={isSelf} title={isSelf ? "You can't change your own role" : undefined} onChange={(e) => setRoleId(e.target.value)}>
              {roles.map((r) => (
                <option key={r.id} value={r.id}>{r.name}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="afs-form-row">
          <div className="afs-form-field">
            <label>Assigned Site</label>
            <select value={siteId} onChange={(e) => setSiteId(e.target.value)}>
              <option value="">All sites (unrestricted)</option>
              {sites.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
          <div className="afs-form-field">
            <label>Monthly Salary</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={salary}
              onChange={(e) => setSalary(e.target.value)}
              placeholder="Rs. -- not set"
            />
          </div>
        </div>

        {message && <div style={{ fontSize: 13, marginBottom: 10, color: message.kind === "success" ? "#14532d" : "#b91c1c" }}>{message.text}</div>}

        <button type="submit" disabled={saving} className="afs-btn afs-btn-primary">
          {saving ? "Saving…" : "Save"}
        </button>
      </form>

      <h3 style={{ fontSize: 14, fontWeight: 600, marginTop: 28, marginBottom: 10, color: "#334" }}>ID Details (self-entered, view only)</h3>
      <div className="afs-form-row">
        <div className="afs-form-field">
          <label>Aadhar Number</label>
          <input readOnly value={user.aadharNumber || "—"} />
        </div>
        <div className="afs-form-field">
          <label>PAN Number</label>
          <input readOnly value={user.panNumber || "—"} />
        </div>
      </div>

      <h3 style={{ fontSize: 14, fontWeight: 600, marginTop: 20, marginBottom: 10, color: "#334" }}>Bank Details (self-entered, view only)</h3>
      <div className="afs-form-row">
        <div className="afs-form-field">
          <label>Account Holder Name</label>
          <input readOnly value={user.bankAccountName || "—"} />
        </div>
        <div className="afs-form-field">
          <label>Account Number</label>
          <input readOnly value={user.bankAccountNo || "—"} />
        </div>
      </div>
      <div className="afs-form-row">
        <div className="afs-form-field">
          <label>IFSC Code</label>
          <input readOnly value={user.bankIfsc || "—"} />
        </div>
        <div className="afs-form-field">
          <label>Bank Name</label>
          <input readOnly value={user.bankName || "—"} />
        </div>
      </div>
    </div>
  );
}
