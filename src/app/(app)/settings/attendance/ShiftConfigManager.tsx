"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { TrashIcon } from "@/components/icons";

export interface ShiftConfigSummary {
  id: string;
  name: string;
  roleId: string | null;
  roleName: string | null;
  startTime: string;
  endTime: string;
  gracePeriodMins: number;
  halfDayThresholdHrs: number;
  fullDayThresholdHrs: number;
  overtimeAfterHrs: number;
}

interface RoleOption {
  id: string;
  name: string;
}

const emptyForm = {
  name: "",
  roleId: "",
  startTime: "09:30",
  endTime: "18:30",
  gracePeriodMins: 10,
  halfDayThresholdHrs: 4,
  fullDayThresholdHrs: 8,
  overtimeAfterHrs: 9,
};

export default function ShiftConfigManager({ shifts, roles }: { shifts: ShiftConfigSummary[]; roles: RoleOption[] }) {
  const router = useRouter();
  const [mode, setMode] = useState<"list" | "new" | string>("list");
  const [form, setForm] = useState(emptyForm);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const rolesInUse = new Set(shifts.map((s) => s.roleId).filter((r): r is string => r !== null));
  const hasDefault = shifts.some((s) => s.roleId === null);
  const availableRoles = roles.filter((r) => !rolesInUse.has(r.id));

  function openNew() {
    setForm(emptyForm);
    setError(null);
    setMode("new");
  }

  function openEdit(shift: ShiftConfigSummary) {
    setForm({
      name: shift.name,
      roleId: shift.roleId ?? "",
      startTime: shift.startTime,
      endTime: shift.endTime,
      gracePeriodMins: shift.gracePeriodMins,
      halfDayThresholdHrs: shift.halfDayThresholdHrs,
      fullDayThresholdHrs: shift.fullDayThresholdHrs,
      overtimeAfterHrs: shift.overtimeAfterHrs,
    });
    setError(null);
    setMode(shift.id);
  }

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const isNew = mode === "new";
      const url = isNew ? "/api/shift-configs" : `/api/shift-configs/${mode}`;
      const body: Record<string, unknown> = {
        name: form.name,
        startTime: form.startTime,
        endTime: form.endTime,
        gracePeriodMins: Number(form.gracePeriodMins),
        halfDayThresholdHrs: Number(form.halfDayThresholdHrs),
        fullDayThresholdHrs: Number(form.fullDayThresholdHrs),
        overtimeAfterHrs: Number(form.overtimeAfterHrs),
      };
      if (isNew) body.roleId = form.roleId || null;

      const res = await fetch(url, {
        method: isNew ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save shift");
      setMode("list");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save shift");
    } finally {
      setSaving(false);
    }
  }

  async function deleteShift(shift: ShiftConfigSummary) {
    if (!window.confirm(`Delete shift "${shift.name}"?`)) return;
    setBusyId(shift.id);
    setError(null);
    try {
      const res = await fetch(`/api/shift-configs/${shift.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to delete shift");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete shift");
    } finally {
      setBusyId(null);
    }
  }

  if (mode === "new" || shifts.some((s) => s.id === mode)) {
    const isNew = mode === "new";
    return (
      <form onSubmit={onSubmit}>
        <div className="afs-form-row">
          <div className="afs-form-field">
            <label>Shift name *</label>
            <input required value={form.name} onChange={(e) => set("name", e.target.value)} />
          </div>
          {isNew && (
            <div className="afs-form-field">
              <label>Applies to</label>
              <select value={form.roleId} onChange={(e) => set("roleId", e.target.value)}>
                {!hasDefault && <option value="">All roles (tenant default)</option>}
                {availableRoles.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
        <div className="afs-form-row">
          <div className="afs-form-field">
            <label>Shift start *</label>
            <input required type="time" value={form.startTime} onChange={(e) => set("startTime", e.target.value)} />
          </div>
          <div className="afs-form-field">
            <label>Shift end *</label>
            <input required type="time" value={form.endTime} onChange={(e) => set("endTime", e.target.value)} />
          </div>
          <div className="afs-form-field">
            <label>Grace period (mins)</label>
            <input type="number" min="0" value={form.gracePeriodMins} onChange={(e) => set("gracePeriodMins", Number(e.target.value))} />
          </div>
        </div>
        <div className="afs-form-row">
          <div className="afs-form-field">
            <label>Half-day threshold (hrs)</label>
            <input type="number" min="0" step="0.5" value={form.halfDayThresholdHrs} onChange={(e) => set("halfDayThresholdHrs", Number(e.target.value))} />
          </div>
          <div className="afs-form-field">
            <label>Full-day threshold (hrs)</label>
            <input type="number" min="0" step="0.5" value={form.fullDayThresholdHrs} onChange={(e) => set("fullDayThresholdHrs", Number(e.target.value))} />
          </div>
          <div className="afs-form-field">
            <label>Overtime after (hrs)</label>
            <input type="number" min="0" step="0.5" value={form.overtimeAfterHrs} onChange={(e) => set("overtimeAfterHrs", Number(e.target.value))} />
          </div>
        </div>

        {error && <div style={{ color: "#b91c1c", fontSize: 13, marginBottom: 12 }}>{error}</div>}

        <div style={{ display: "flex", gap: 10 }}>
          <button type="button" onClick={() => setMode("list")} disabled={saving} className="afs-btn" style={{ background: "#e5e7eb", color: "#333" }}>
            Cancel
          </button>
          <button type="submit" disabled={saving} className="afs-btn afs-btn-primary">
            {saving ? "Saving…" : "Save Shift"}
          </button>
        </div>
      </form>
    );
  }

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <button type="button" onClick={openNew} disabled={hasDefault && availableRoles.length === 0} className="afs-btn afs-btn-primary">
          + New Shift
        </button>
      </div>

      {error && <div style={{ color: "#b91c1c", fontSize: 13, marginBottom: 12 }}>{error}</div>}

      {shifts.length === 0 ? (
        <div className="afs-empty">No shifts configured yet.</div>
      ) : (
        <table className="afs-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Applies to</th>
              <th>Timing</th>
              <th>Grace</th>
              <th>Half / Full day</th>
              <th>Overtime after</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {shifts.map((s) => (
              <tr key={s.id}>
                <td data-label="Name">{s.name}</td>
                <td data-label="Applies to">
                  {s.roleId === null ? (
                    <span className="afs-badge" style={{ background: "#fff7e0", color: "#5c4a00" }}>
                      All roles (default)
                    </span>
                  ) : (
                    s.roleName
                  )}
                </td>
                <td data-label="Timing">
                  {s.startTime} – {s.endTime}
                </td>
                <td data-label="Grace">{s.gracePeriodMins}m</td>
                <td data-label="Half / Full day">
                  {s.halfDayThresholdHrs}h / {s.fullDayThresholdHrs}h
                </td>
                <td data-label="Overtime after">{s.overtimeAfterHrs}h</td>
                <td>
                  <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                    <button type="button" onClick={() => openEdit(s)} className="afs-btn" style={{ background: "#e5e7eb", color: "#333", padding: "4px 12px" }}>
                      Edit
                    </button>
                    {s.roleId !== null && (
                      <button
                        type="button"
                        onClick={() => deleteShift(s)}
                        disabled={busyId === s.id}
                        title="Delete shift"
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
      )}
    </div>
  );
}
