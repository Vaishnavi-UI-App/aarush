"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { WhatsAppIcon, MailIcon, TrashIcon, EditIcon } from "@/components/icons";
import ArchiveConfirmDialog from "@/components/ArchiveConfirmDialog";

export default function InvoiceViewActions({
  invoiceId,
  invoiceNumber,
  invoiceStatus,
  total,
  customerPhone,
  customerEmail,
  editable,
  archived,
}: {
  invoiceId: string;
  invoiceNumber: string;
  invoiceStatus: string;
  total: number;
  customerPhone: string | null;
  customerEmail: string | null;
  editable: boolean;
  archived: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [waSent, setWaSent] = useState(false);
  const [origin, setOrigin] = useState("");
  const [showArchiveDialog, setShowArchiveDialog] = useState(false);
  const [archiveError, setArchiveError] = useState<string | null>(null);

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

  async function confirmArchive(note: string) {
    setBusy(true);
    setArchiveError(null);
    try {
      const res = await fetch(`/api/invoices/${invoiceId}/archive`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to archive invoice");
      setShowArchiveDialog(false);
      router.push("/invoices");
      router.refresh();
    } catch (e) {
      setArchiveError(e instanceof Error ? e.message : "Failed to archive invoice");
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
    <>
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <a href={`/api/invoices/${invoiceId}/pdf`} target="_blank" rel="noopener noreferrer" className="afs-btn afs-btn-primary">
          ⬇ Download PDF
        </a>
        {editable && (
          <a href={`/invoices/${invoiceId}/edit`} className="afs-icon-btn edit" title="Edit invoice">
            <EditIcon />
          </a>
        )}
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
        {!archived && (
          <button
            type="button"
            onClick={() => setShowArchiveDialog(true)}
            disabled={busy}
            className="afs-icon-btn danger"
            title="Delete (archive)"
          >
            <TrashIcon />
          </button>
        )}
        {error && <span style={{ color: "#b91c1c", fontSize: 11 }}>{error}</span>}
        {notice && <span style={{ color: "#0ca30c", fontSize: 11 }}>{notice}</span>}
      </div>

      {showArchiveDialog && (
        <ArchiveConfirmDialog
          title="Delete invoice"
          itemLabel={`invoice ${invoiceNumber}`}
          busy={busy}
          error={archiveError}
          onConfirm={confirmArchive}
          onCancel={() => setShowArchiveDialog(false)}
        />
      )}
    </>
  );
}
