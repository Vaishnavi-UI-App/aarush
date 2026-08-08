"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface TenantProfile {
  name: string;
  gstin: string;
  pan: string | null;
  cinNo: string | null;
  website: string | null;
  stateCode: string;
  invoicePrefix: string;
  addressLine: string | null;
  phone: string | null;
  email: string | null;
  bankAccountName: string | null;
  bankAccountNo: string | null;
  bankIfsc: string | null;
  bankName: string | null;
  bankBranch: string | null;
  invoiceTerms: string | null;
}

export default function CompanyDetailsForm({ tenant }: { tenant: TenantProfile }) {
  const router = useRouter();
  const [form, setForm] = useState({
    name: tenant.name,
    gstin: tenant.gstin,
    pan: tenant.pan ?? "",
    cinNo: tenant.cinNo ?? "",
    website: tenant.website ?? "",
    stateCode: tenant.stateCode,
    invoicePrefix: tenant.invoicePrefix,
    addressLine: tenant.addressLine ?? "",
    phone: tenant.phone ?? "",
    email: tenant.email ?? "",
    bankAccountName: tenant.bankAccountName ?? "",
    bankAccountNo: tenant.bankAccountNo ?? "",
    bankIfsc: tenant.bankIfsc ?? "",
    bankName: tenant.bankName ?? "",
    bankBranch: tenant.bankBranch ?? "",
    invoiceTerms: tenant.invoiceTerms ?? "",
  });
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch("/api/settings/company", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save");
      setNotice("Saved.");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={onSubmit}>
      <div className="afs-form-row">
        <div className="afs-form-field">
          <label>Company Name *</label>
          <input required value={form.name} onChange={(e) => set("name", e.target.value)} />
        </div>
        <div className="afs-form-field">
          <label>GSTIN *</label>
          <input required value={form.gstin} onChange={(e) => set("gstin", e.target.value)} />
        </div>
        <div className="afs-form-field">
          <label>PAN</label>
          <input value={form.pan} onChange={(e) => set("pan", e.target.value)} />
        </div>
      </div>

      <div className="afs-form-row">
        <div className="afs-form-field">
          <label>CIN No.</label>
          <input value={form.cinNo} onChange={(e) => set("cinNo", e.target.value)} />
        </div>
        <div className="afs-form-field">
          <label>Website</label>
          <input value={form.website} onChange={(e) => set("website", e.target.value)} placeholder="e.g. www.example.com" />
        </div>
      </div>

      <div className="afs-form-row">
        <div className="afs-form-field">
          <label>State Code *</label>
          <input required maxLength={2} value={form.stateCode} onChange={(e) => set("stateCode", e.target.value)} />
        </div>
        <div className="afs-form-field">
          <label>Invoice Prefix</label>
          <input value={form.invoicePrefix} onChange={(e) => set("invoicePrefix", e.target.value)} />
        </div>
        <div className="afs-form-field">
          <label>Phone</label>
          <input value={form.phone} onChange={(e) => set("phone", e.target.value)} />
        </div>
      </div>

      <div className="afs-form-row">
        <div className="afs-form-field">
          <label>Email</label>
          <input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} />
        </div>
        <div className="afs-form-field">
          <label>Address</label>
          <input value={form.addressLine} onChange={(e) => set("addressLine", e.target.value)} />
        </div>
      </div>

      <h3 style={{ marginTop: 24, marginBottom: 12, fontSize: 15 }}>Bank Details (shown on invoices)</h3>

      <div className="afs-form-row">
        <div className="afs-form-field">
          <label>Account Name</label>
          <input value={form.bankAccountName} onChange={(e) => set("bankAccountName", e.target.value)} />
        </div>
        <div className="afs-form-field">
          <label>Account Number</label>
          <input value={form.bankAccountNo} onChange={(e) => set("bankAccountNo", e.target.value)} />
        </div>
        <div className="afs-form-field">
          <label>IFSC Code</label>
          <input value={form.bankIfsc} onChange={(e) => set("bankIfsc", e.target.value)} />
        </div>
      </div>

      <div className="afs-form-row">
        <div className="afs-form-field">
          <label>Bank Name</label>
          <input value={form.bankName} onChange={(e) => set("bankName", e.target.value)} />
        </div>
        <div className="afs-form-field">
          <label>Branch</label>
          <input value={form.bankBranch} onChange={(e) => set("bankBranch", e.target.value)} />
        </div>
      </div>

      <div className="afs-form-field" style={{ marginBottom: 16 }}>
        <label>Invoice Terms &amp; Conditions</label>
        <textarea rows={4} value={form.invoiceTerms} onChange={(e) => set("invoiceTerms", e.target.value)} />
      </div>

      {error && <div style={{ color: "#b91c1c", fontSize: 13, marginBottom: 10 }}>{error}</div>}
      {notice && <div style={{ color: "#0ca30c", fontSize: 13, marginBottom: 10 }}>{notice}</div>}

      <button type="submit" disabled={saving} className="afs-btn afs-btn-primary">
        {saving ? "Saving…" : "Save Changes"}
      </button>
    </form>
  );
}
