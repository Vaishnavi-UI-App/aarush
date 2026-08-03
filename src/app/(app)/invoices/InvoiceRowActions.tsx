"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { WhatsAppIcon, MailIcon, DownloadIcon, TrashIcon, ViewIcon } from "@/components/icons";

export default function InvoiceRowActions({
  invoiceId,
  invoiceNumber,
  invoiceStatus,
  total,
  customerPhone,
  customerEmail,
}: {
  invoiceId: string;
  invoiceNumber: string;
  invoiceStatus: string;
  total: number;
  customerPhone: string | null;
  customerEmail: string | null;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [waSent, setWaSent] = useState(false);
  const [origin, setOrigin] = useState("");

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), 4000);
    return () => clearTimeout(timer);
  }, [notice]);

  async function sendWhatsapp(e: React.MouseEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/invoices/${invoiceId}/send-whatsapp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to send WhatsApp message");
      setWaSent(true);
    } catch {
      // Business API not configured (or failed) -- fall back to a manual wa.me share.
      if (whatsappHref) window.open(whatsappHref, "_blank", "noopener,noreferrer");
    } finally {
      setBusy(false);
    }
  }

  async function emailInvoice() {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      // Any invoice that isn't already paid/cancelled gets a Razorpay payment link
      // bundled into the email so the customer can pay straight from their inbox.
      const collectsPayment = invoiceStatus !== "PAID" && invoiceStatus !== "CANCELLED";

      if (collectsPayment) {
        const res = await fetch("/api/payments/create-link", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ invoiceId }),
        });
        const data = await res.json();
        if (res.ok && data.emailed) {
          setNotice("Email sent successfully");
          return;
        }
        // Payment link couldn't be created (Razorpay not configured, "nothing due", API
        // error, etc.) or was created but the email failed -- fall through to a plain
        // PDF email either way instead of leaving the customer with nothing.
      }

      const res = await fetch(`/api/invoices/${invoiceId}/send-email`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to send email");
      setNotice("Email sent successfully");
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
    setNotice(null);
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
        `Hi, your invoice ${invoiceNumber} for Rs. ${total.toFixed(2)} is ready. You can view/download it here: ${origin}/invoices/${invoiceId}`
      )}`
    : null;

  return (
    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
      <a href={`/invoices/${invoiceId}`} className="afs-icon-btn" title="View invoice">
        <ViewIcon />
      </a>
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
        onClick={whatsappHref ? sendWhatsapp : undefined}
        title={waSent ? "Sent via WhatsApp" : whatsappHref ? "Send invoice via WhatsApp" : "No phone number on file"}
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
      {notice && <span style={{ color: "#0ca30c", fontSize: 11 }}>{notice}</span>}
    </div>
  );
}
