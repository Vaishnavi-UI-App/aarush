"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

interface PayslipData {
  id: string;
  status: "DRAFT" | "FINALIZED";
  workingDays: number;
  presentDays: number;
  lopDays: number;
  basic: number;
  hra: number;
  conveyance: number;
  medicalAllowance: number;
  specialAllowance: number;
  grossEarnings: number;
  tds: number;
  professionalTax: number;
  lopDeduction: number;
  otherDeductions: number;
  totalDeductions: number;
  reimbursements: number;
  netPayable: number;
}

const EARNING_FIELDS = [
  ["basic", "Basic"],
  ["hra", "HRA"],
  ["conveyance", "Conveyance"],
  ["medicalAllowance", "Medical Allowance"],
  ["specialAllowance", "Special Allowance"],
] as const;

const DEDUCTION_FIELDS = [
  ["tds", "TDS"],
  ["professionalTax", "Professional Tax"],
  ["lopDeduction", "Loss of Pay Deduction"],
  ["otherDeductions", "Other Deductions"],
] as const;

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export default function PayslipEditForm({ payslip }: { payslip: PayslipData }) {
  const router = useRouter();
  const [form, setForm] = useState(payslip);
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: "success" | "error"; text: string } | null>(null);

  const locked = form.status === "FINALIZED";

  const computed = useMemo(() => {
    const gross = round2(form.basic + form.hra + form.conveyance + form.medicalAllowance + form.specialAllowance);
    const totalDeductions = round2(form.tds + form.professionalTax + form.lopDeduction + form.otherDeductions);
    const net = round2(gross - totalDeductions + form.reimbursements);
    return { gross, totalDeductions, net };
  }, [form]);

  function setField(key: keyof PayslipData, value: string) {
    const n = value === "" ? 0 : Number(value);
    setForm((f) => ({ ...f, [key]: Number.isNaN(n) ? f[key] : n }));
  }

  async function save() {
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/payroll/${form.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workingDays: form.workingDays,
          presentDays: form.presentDays,
          lopDays: form.lopDays,
          basic: form.basic,
          hra: form.hra,
          conveyance: form.conveyance,
          medicalAllowance: form.medicalAllowance,
          specialAllowance: form.specialAllowance,
          tds: form.tds,
          professionalTax: form.professionalTax,
          lopDeduction: form.lopDeduction,
          otherDeductions: form.otherDeductions,
          reimbursements: form.reimbursements,
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

  async function finalize() {
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/payroll/${form.id}/finalize`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to finalize");
      setMessage({
        kind: data.emailed ? "success" : "error",
        text: data.emailed ? "Finalized and emailed to the employee." : `Finalized, but emailing failed: ${data.emailError}`,
      });
      router.refresh();
    } catch (e) {
      setMessage({ kind: "error", text: e instanceof Error ? e.message : "Failed to finalize" });
    } finally {
      setBusy(false);
    }
  }

  async function reopen() {
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/payroll/${form.id}/reopen`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to reopen");
      setMessage({ kind: "success", text: "Reopened -- now editable again." });
      router.refresh();
    } catch (e) {
      setMessage({ kind: "error", text: e instanceof Error ? e.message : "Failed to reopen" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="afs-card" style={{ marginTop: 16 }}>
      <div className="afs-form-row">
        <div className="afs-form-field" style={{ maxWidth: 140 }}>
          <label>Working Days</label>
          <input type="number" disabled={locked} value={form.workingDays} onChange={(e) => setField("workingDays", e.target.value)} />
        </div>
        <div className="afs-form-field" style={{ maxWidth: 140 }}>
          <label>Present Days</label>
          <input type="number" disabled={locked} value={form.presentDays} onChange={(e) => setField("presentDays", e.target.value)} />
        </div>
        <div className="afs-form-field" style={{ maxWidth: 140 }}>
          <label>LOP Days</label>
          <input type="number" disabled={locked} value={form.lopDays} onChange={(e) => setField("lopDays", e.target.value)} />
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginTop: 16 }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Earnings</div>
          {EARNING_FIELDS.map(([key, label]) => (
            <div className="afs-form-field" key={key} style={{ marginBottom: 8 }}>
              <label>{label}</label>
              <input type="number" step="0.01" disabled={locked} value={form[key]} onChange={(e) => setField(key, e.target.value)} />
            </div>
          ))}
          <div style={{ fontSize: 13, fontWeight: 700, marginTop: 6 }}>Gross Earnings: Rs. {computed.gross.toFixed(2)}</div>
        </div>

        <div>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Deductions</div>
          {DEDUCTION_FIELDS.map(([key, label]) => (
            <div className="afs-form-field" key={key} style={{ marginBottom: 8 }}>
              <label>{label}</label>
              <input type="number" step="0.01" disabled={locked} value={form[key]} onChange={(e) => setField(key, e.target.value)} />
            </div>
          ))}
          <div style={{ fontSize: 13, fontWeight: 700, marginTop: 6 }}>Total Deductions: Rs. {computed.totalDeductions.toFixed(2)}</div>

          <div className="afs-form-field" style={{ marginTop: 16, marginBottom: 8 }}>
            <label>Reimbursements</label>
            <input type="number" step="0.01" disabled={locked} value={form.reimbursements} onChange={(e) => setField("reimbursements", e.target.value)} />
          </div>
        </div>
      </div>

      <div
        style={{
          marginTop: 16,
          padding: "12px 16px",
          background: "#eef4ff",
          border: "1px solid #b9d0f5",
          borderRadius: 4,
          display: "flex",
          justifyContent: "space-between",
          fontSize: 15,
          fontWeight: 700,
          color: "#14213d",
        }}
      >
        <span>Net Payable</span>
        <span>Rs. {computed.net.toFixed(2)}</span>
      </div>

      {message && (
        <div style={{ marginTop: 12, fontSize: 13, color: message.kind === "success" ? "#14532d" : "#b91c1c" }}>{message.text}</div>
      )}

      <div style={{ display: "flex", gap: 10, marginTop: 16, flexWrap: "wrap" }}>
        {!locked && (
          <>
            <button type="button" onClick={save} disabled={saving} className="afs-btn" style={{ background: "#e5e7eb", color: "#333" }}>
              {saving ? "Saving…" : "Save Draft"}
            </button>
            <button type="button" onClick={finalize} disabled={busy} className="afs-btn afs-btn-primary">
              {busy ? "Finalizing…" : "Finalize & Email"}
            </button>
          </>
        )}
        {locked && (
          <button type="button" onClick={reopen} disabled={busy} className="afs-btn afs-btn-maroon">
            {busy ? "Reopening…" : "Reopen for Editing"}
          </button>
        )}
        <a href={`/api/payroll/${form.id}/pdf`} className="afs-btn" style={{ background: "#e5e7eb", color: "#333" }}>
          Download PDF
        </a>
      </div>
    </div>
  );
}
