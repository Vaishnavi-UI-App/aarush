"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface PayslipDTO {
  id: string;
  status: "DRAFT" | "FINALIZED";
  netPayable: string;
  presentDays: string;
  lopDays: string;
  emailedAt: string | null;
}

interface RowDTO {
  user: { id: string; name: string | null; email: string };
  payslip: PayslipDTO | null;
  needsSalary: boolean;
}

interface PayrollConfigDTO {
  basicPercent: string;
  hraPercent: string;
  conveyancePercent: string;
  medicalPercent: string;
  specialAllowancePercent: string;
  professionalTax: string;
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function money(n: string | number): string {
  return `Rs. ${Number(n).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function PayrollDashboard() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [rows, setRows] = useState<RowDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [config, setConfig] = useState<PayrollConfigDTO | null>(null);
  const [savingConfig, setSavingConfig] = useState(false);

  async function load() {
    setLoading(true);
    setSelected([]);
    try {
      const res = await fetch(`/api/payroll?year=${year}&month=${month}`);
      const data = await res.json();
      setRows(Array.isArray(data) ? data : []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year, month]);

  async function loadConfig() {
    const res = await fetch("/api/payroll/config");
    const data = await res.json();
    setConfig(data);
  }

  function toggleSettings() {
    if (!showSettings && !config) loadConfig();
    setShowSettings((v) => !v);
  }

  async function saveConfig(e: React.FormEvent) {
    e.preventDefault();
    if (!config) return;
    setSavingConfig(true);
    try {
      const res = await fetch("/api/payroll/config", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          basicPercent: Number(config.basicPercent),
          hraPercent: Number(config.hraPercent),
          conveyancePercent: Number(config.conveyancePercent),
          medicalPercent: Number(config.medicalPercent),
          specialAllowancePercent: Number(config.specialAllowancePercent),
          professionalTax: Number(config.professionalTax),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save");
      setConfig(data);
      await load();
    } finally {
      setSavingConfig(false);
    }
  }

  const selectableRows = rows.filter((r) => r.payslip && r.payslip.status === "DRAFT");
  const allSelected = selectableRows.length > 0 && selectableRows.every((r) => selected.includes(r.payslip!.id));

  function toggleAll() {
    setSelected(allSelected ? [] : selectableRows.map((r) => r.payslip!.id));
  }

  function toggleOne(id: string, checked: boolean) {
    setSelected((prev) => (checked ? [...prev, id] : prev.filter((x) => x !== id)));
  }

  async function finalizeSelected() {
    if (selected.length === 0) return;
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch("/api/payroll/finalize-bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: selected }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to finalize");
      const okCount = data.results.filter((r: { ok: boolean }) => r.ok).length;
      const emailedCount = data.results.filter((r: { emailed?: boolean }) => r.emailed).length;
      setMessage(`Finalized ${okCount} of ${selected.length} payslip(s). ${emailedCount} emailed successfully.`);
      await load();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Failed to finalize");
    } finally {
      setBusy(false);
    }
  }

  const years = [now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1];

  return (
    <div>
      <div className="afs-page-header">
        <div>
          <h1 className="afs-page-title">Payroll</h1>
          <p className="afs-page-subtitle">Monthly salary slips, calculated from attendance and each employee&apos;s salary</p>
        </div>
        <div className="afs-page-header-actions">
          <button type="button" onClick={toggleSettings} className="afs-btn" style={{ background: "#e5e7eb", color: "#333" }}>
            {showSettings ? "Hide" : "Salary Structure Settings"}
          </button>
        </div>
      </div>

      {showSettings && config && (
        <form onSubmit={saveConfig} className="afs-card" style={{ marginTop: 16, marginBottom: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>
            Salary component split (% of Monthly Salary) &amp; flat Professional Tax
          </div>
          <div className="afs-form-row">
            {(
              [
                ["basicPercent", "Basic %"],
                ["hraPercent", "HRA %"],
                ["conveyancePercent", "Conveyance %"],
                ["medicalPercent", "Medical %"],
                ["specialAllowancePercent", "Special Allowance %"],
              ] as const
            ).map(([key, label]) => (
              <div className="afs-form-field" key={key} style={{ maxWidth: 140 }}>
                <label>{label}</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={config[key]}
                  onChange={(e) => setConfig({ ...config, [key]: e.target.value })}
                />
              </div>
            ))}
            <div className="afs-form-field" style={{ maxWidth: 160 }}>
              <label>Professional Tax (flat, Rs.)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={config.professionalTax}
                onChange={(e) => setConfig({ ...config, professionalTax: e.target.value })}
              />
            </div>
          </div>
          <button type="submit" disabled={savingConfig} className="afs-btn afs-btn-primary" style={{ marginTop: 8 }}>
            {savingConfig ? "Saving…" : "Save"}
          </button>
        </form>
      )}

      <div className="afs-card" style={{ marginTop: 16, marginBottom: 20, padding: 16 }}>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
          <div className="afs-form-field" style={{ maxWidth: 180 }}>
            <label>Month</label>
            <select value={month} onChange={(e) => setMonth(Number(e.target.value))}>
              {MONTH_NAMES.map((m, i) => (
                <option key={m} value={i + 1}>{m}</option>
              ))}
            </select>
          </div>
          <div className="afs-form-field" style={{ maxWidth: 120 }}>
            <label>Year</label>
            <select value={year} onChange={(e) => setYear(Number(e.target.value))}>
              {years.map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>
          <button
            type="button"
            disabled={busy || selected.length === 0}
            onClick={finalizeSelected}
            className="afs-btn afs-btn-primary"
          >
            {busy ? "Finalizing…" : `Finalize & Email Selected (${selected.length})`}
          </button>
        </div>
        {message && <div style={{ marginTop: 10, fontSize: 13, color: "#334" }}>{message}</div>}
      </div>

      <div className="afs-card">
        {loading ? (
          <div className="afs-empty">Loading…</div>
        ) : rows.length === 0 ? (
          <div className="afs-empty">No employees found.</div>
        ) : (
          <table className="afs-table">
            <thead>
              <tr>
                <th>
                  <input type="checkbox" checked={allSelected} onChange={toggleAll} disabled={selectableRows.length === 0} />
                </th>
                <th>Employee</th>
                <th>Present Days</th>
                <th>LOP Days</th>
                <th>Net Payable</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.user.id}>
                  <td>
                    {r.payslip && r.payslip.status === "DRAFT" && (
                      <input
                        type="checkbox"
                        checked={selected.includes(r.payslip.id)}
                        onChange={(e) => toggleOne(r.payslip!.id, e.target.checked)}
                      />
                    )}
                  </td>
                  <td data-label="Employee">{r.user.name || r.user.email}</td>
                  <td data-label="Present Days">{r.payslip ? r.payslip.presentDays : "—"}</td>
                  <td data-label="LOP Days">{r.payslip ? r.payslip.lopDays : "—"}</td>
                  <td data-label="Net Payable">{r.payslip ? money(r.payslip.netPayable) : "—"}</td>
                  <td data-label="Status">
                    {r.needsSalary ? (
                      <span style={{ fontSize: 12, color: "#b45309" }}>No monthly salary set</span>
                    ) : (
                      <span className={r.payslip?.status === "FINALIZED" ? "afs-badge afs-badge-paid" : "afs-badge afs-badge-draft"}>
                        {r.payslip?.status === "FINALIZED" ? "Finalized" : "Draft"}
                      </span>
                    )}
                    {r.payslip?.emailedAt && <span style={{ fontSize: 11, color: "#889", marginLeft: 6 }}>emailed</span>}
                  </td>
                  <td>
                    {r.payslip && (
                      <Link href={`/payroll/${r.payslip.id}`} className="afs-btn" style={{ background: "#e5e7eb", color: "#333", padding: "4px 10px", fontSize: 12 }}>
                        View / Edit
                      </Link>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
