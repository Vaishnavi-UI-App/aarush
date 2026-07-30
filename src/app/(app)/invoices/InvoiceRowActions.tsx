"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { WhatsAppIcon, MailIcon, DownloadIcon, TrashIcon } from "@/components/icons";

export default function InvoiceRowActions({
  invoiceId,
  invoiceNumber,
  total,
  customerPhone,
  customerEmail,
}: {
  invoiceId: string;
  invoiceNumber: string;
  total: number;
  customerPhone: string | null;
  customerEmail: string | null;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function emailInvoice() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/invoices/${invoiceId}/send-email`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to send email");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to send email");
    } finally {
      setBusy(false);
    }
  }

  async function archiveInvoice() {
    if (!window.confirm(`Move invoice ${invoiceNumber} to Archive? You can restore it later.`)) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/invoices/${invoiceId}/archive`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to archive invoice");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to archive invoice");
    } finally {
      setBusy(false);
    }
  }

  const whatsappHref = customerPhone
    ? `https://wa.me/91${customerPhone.replace(/\D/g, "")}?text=${encodeURIComponent(
        `Hi, your invoice ${invoiceNumber} for Rs. ${total.toFixed(2)} is ready. You can view/download it here: ${typeof window !== "undefined" ? window.location.origin : ""}/invoices/${invoiceId}`
      )}`
    : null;

  return (
    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
      <a
        href={`/api/invoices/${invoiceId}/pdf`}
        target="_blank"
        rel="noopener noreferrer"
        className="afs-icon-btn"
        title="Download PDF"
      >
        <DownloadIcon />
      </a>
      <a
        className={`afs-icon-btn whatsapp ${whatsappHref ? "" : "disabled"}`}
        href={whatsappHref ?? undefined}
        target="_blank"
        rel="noopener noreferrer"
        title={whatsappHref ? "Share on WhatsApp" : "No phone number on file"}
      >
        <WhatsAppIcon />
      </a>
      <button
        type="button"
        onClick={emailInvoice}
        disabled={busy || !customerEmail}
        className="afs-icon-btn mail"
        title={customerEmail ? "Email invoice PDF" : "No email on file"}
      >
        <MailIcon />
      </button>
      <button type="button" onClick={archiveInvoice} disabled={busy} className="afs-icon-btn danger" title="Archive (soft delete)">
        <TrashIcon />
      </button>
      {error && <span style={{ color: "#b91c1c", fontSize: 11 }}>{error}</span>}
    </div>
  );
}
