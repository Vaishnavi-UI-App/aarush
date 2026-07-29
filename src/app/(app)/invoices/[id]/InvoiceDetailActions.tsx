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
  payments,
}: {
  invoiceId: string;
  invoiceType: "SALE" | "PROFORMA" | "CREDIT_NOTE";
  status: string;
  payments: Payment[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: "success" | "error"; text: string } | null>(null);
  const [paymentLinkUrl, setPaymentLinkUrl] = useState<string | null>(null);

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

  async function convertToSale() {
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/invoices/${invoiceId}/convert-to-sale`, { method: "POST" });
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
        {invoiceType === "PROFORMA" && status !== "CANCELLED" && (
          <button onClick={convertToSale} disabled={busy} className="afs-btn afs-btn-primary">
            Convert to Sale Invoice
          </button>
        )}
        {invoiceType === "SALE" && status !== "PAID" && status !== "CANCELLED" && (
          <button onClick={createPaymentLink} disabled={busy} className="afs-btn afs-btn-maroon">
            Create Razorpay Payment Link
          </button>
        )}
        {message && (
          <span className={message.kind === "success" ? "afs-status afs-status-success" : "afs-status afs-status-error"}>
            {message.text}
          </span>
        )}
      </div>

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
