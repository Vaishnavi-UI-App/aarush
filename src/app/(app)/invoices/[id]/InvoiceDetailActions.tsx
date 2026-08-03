"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Payment {
  id: string;
  amount: number;
  status: string;
  mode: string;
}

export default function InvoiceDetailActions({
  invoiceId,
  invoiceType,
  status,
  customerId,
  amountDue,
  payments,
}: {
  invoiceId: string;
  invoiceType: "SALE" | "PROFORMA" | "CREDIT_NOTE";
  status: string;
  customerId: string;
  amountDue: number;
  payments: Payment[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: "success" | "error"; text: string } | null>(null);
  const [paymentLinkUrl, setPaymentLinkUrl] = useState<string | null>(null);
  const [showCashForm, setShowCashForm] = useState(false);
  const [cashAmount, setCashAmount] = useState(amountDue > 0 ? amountDue.toFixed(2) : "");
  const [cashMode, setCashMode] = useState("CASH");
  const [cashReference, setCashReference] = useState("");
  const [showConvertForm, setShowConvertForm] = useState(false);
  const [conversionNote, setConversionNote] = useState("");

  async function recordManualPayment(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/customers/${customerId}/payments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: Number(cashAmount),
          mode: cashMode,
          referenceNo: cashReference || undefined,
          invoiceId,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to record payment");
      setMessage({ kind: "success", text: "Payment recorded." });
      setShowCashForm(false);
      router.refresh();
    } catch (e) {
      setMessage({ kind: "error", text: e instanceof Error ? e.message : "Failed to record payment" });
    } finally {
      setBusy(false);
    }
  }

  async function createPaymentLink() {
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch("/api/payments/create-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invoiceId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create payment link");
      setPaymentLinkUrl(data.paymentLinkUrl);
      if (data.emailed) {
        setMessage({ kind: "success", text: "Invoice + payment link emailed to the customer." });
      } else if (data.emailError) {
        setMessage({ kind: "error", text: `Payment link created, but the email failed: ${data.emailError}` });
      } else {
        setMessage({ kind: "error", text: "Payment link created, but no email is on file for this customer -- share the link manually." });
      }
    } catch (e) {
      setMessage({ kind: "error", text: e instanceof Error ? e.message : "Failed to create payment link" });
    } finally {
      setBusy(false);
    }
  }

  async function convertToSale(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/invoices/${invoiceId}/convert-to-sale`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note: conversionNote.trim() || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to convert proforma");
      router.push(`/invoices/${data.id}`);
      router.refresh();
    } catch (e) {
      setMessage({ kind: "error", text: e instanceof Error ? e.message : "Failed to convert proforma" });
      setBusy(false);
    }
  }

  return (
    <div className="afs-card">
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
        {invoiceType === "PROFORMA" && status !== "CANCELLED" && status !== "APPROVED" && (
          <button onClick={() => setShowConvertForm((v) => !v)} disabled={busy} className="afs-btn afs-btn-primary">
            Convert to Sale Invoice
          </button>
        )}
        {invoiceType === "SALE" && status !== "PAID" && status !== "CANCELLED" && (
          <button onClick={createPaymentLink} disabled={busy} className="afs-btn afs-btn-maroon">
            Create Razorpay Payment Link
          </button>
        )}
        {invoiceType === "SALE" && status !== "PAID" && status !== "CANCELLED" && (
          <button onClick={() => setShowCashForm((v) => !v)} disabled={busy} className="afs-btn" style={{ background: "#e5e7eb", color: "#333" }}>
            Record Cash / Manual Payment
          </button>
        )}
        {message && (
          <span className={message.kind === "success" ? "afs-status afs-status-success" : "afs-status afs-status-error"}>
            {message.text}
          </span>
        )}
      </div>

      {showConvertForm && (
        <form onSubmit={convertToSale} style={{ marginTop: 16, display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end" }}>
          <div className="afs-form-field" style={{ flex: "1 1 320px" }}>
            <label>Internal note (optional -- visible to OWNER only, never shown to the customer)</label>
            <textarea
              rows={2}
              value={conversionNote}
              onChange={(e) => setConversionNote(e.target.value)}
              style={{ width: "100%", resize: "vertical" }}
            />
          </div>
          <button type="submit" disabled={busy} className="afs-btn afs-btn-primary">
            {busy ? "Converting…" : "Confirm Conversion"}
          </button>
        </form>
      )}

      {showCashForm && (
        <form onSubmit={recordManualPayment} style={{ marginTop: 16, display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end" }}>
          <div className="afs-form-field" style={{ maxWidth: 140 }}>
            <label>Amount *</label>
            <input required type="number" min="0.01" step="0.01" value={cashAmount} onChange={(e) => setCashAmount(e.target.value)} />
          </div>
          <div className="afs-form-field" style={{ maxWidth: 160 }}>
            <label>Mode *</label>
            <select value={cashMode} onChange={(e) => setCashMode(e.target.value)}>
              {["CASH", "UPI", "BANK_TRANSFER", "CHEQUE", "OTHER"].map((m) => (
                <option key={m} value={m}>
                  {m.replace("_", " ")}
                </option>
              ))}
            </select>
          </div>
          <div className="afs-form-field" style={{ maxWidth: 180 }}>
            <label>Reference no.</label>
            <input value={cashReference} onChange={(e) => setCashReference(e.target.value)} />
          </div>
          <button type="submit" disabled={busy} className="afs-btn afs-btn-primary">
            {busy ? "Recording…" : "Record Payment"}
          </button>
        </form>
      )}

      {paymentLinkUrl && (
        <div style={{ marginTop: 12, fontSize: 13 }}>
          Payment link:{" "}
          <a href={paymentLinkUrl} target="_blank" rel="noopener noreferrer">
            {paymentLinkUrl}
          </a>
        </div>
      )}

      {payments.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>Payments</div>
          <table className="afs-table">
            <thead>
              <tr>
                <th>Amount</th>
                <th>Mode</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {payments.map((p) => (
                <tr key={p.id}>
                  <td>Rs. {p.amount.toFixed(2)}</td>
                  <td>{p.mode}</td>
                  <td>{p.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
