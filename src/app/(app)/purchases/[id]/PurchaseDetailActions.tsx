"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import ArchiveConfirmDialog from "@/components/ArchiveConfirmDialog";
import { WhatsAppIcon, MailIcon } from "@/components/icons";

export default function PurchaseDetailActions({
  purchaseId,
  purchaseNumber,
  total,
  vendorPhone,
  vendorEmail,
  archived,
  editable,
}: {
  purchaseId: string;
  purchaseNumber: string;
  total: number;
  vendorPhone: string | null;
  vendorEmail: string | null;
  archived: boolean;
  editable: boolean;
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

  async function restore() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/purchases/${purchaseId}/restore`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to restore");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to restore");
    } finally {
      setBusy(false);
    }
  }

  async function confirmArchive(note: string) {
    setBusy(true);
    setArchiveError(null);
    try {
      const res = await fetch(`/api/purchases/${purchaseId}/archive`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to archive");
      setShowArchiveDialog(false);
      router.push("/purchases");
      router.refresh();
    } catch (e) {
      setArchiveError(e instanceof Error ? e.message : "Failed to archive");
    } finally {
      setBusy(false);
    }
  }

  async function sendWhatsapp(e: React.MouseEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/purchases/${purchaseId}/send-whatsapp`, {
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

  async function emailPurchase() {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch(`/api/purchases/${purchaseId}/send-email`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to send email");
      setNotice("Email sent successfully");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to send email");
    } finally {
      setBusy(false);
    }
  }

  const whatsappHref = vendorPhone
    ? `https://wa.me/91${vendorPhone.replace(/\D/g, "")}?text=${encodeURIComponent(
        `Purchase bill ${purchaseNumber} for Rs. ${total.toFixed(2)} is recorded. You can view it here: ${origin}/purchases/${purchaseId}`
      )}`
    : null;

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
      {editable && (
        <Link href={`/purchases/${purchaseId}/edit`} className="afs-btn" style={{ background: "#e5e7eb", color: "#333" }}>
          Edit
        </Link>
      )}
      <a href={`/api/purchases/${purchaseId}/pdf`} target="_blank" rel="noopener noreferrer" className="afs-btn afs-btn-primary">
        ⬇ Download PDF
      </a>
      <a
        className={`afs-icon-btn whatsapp ${whatsappHref ? "" : "disabled"}`}
        href={whatsappHref ?? undefined}
        target="_blank"
        rel="noopener noreferrer"
        onClick={whatsappHref ? sendWhatsapp : undefined}
        title={waSent ? "Sent via WhatsApp" : whatsappHref ? "Send purchase bill via WhatsApp" : "No phone number on file"}
      >
        <WhatsAppIcon />
      </a>
      <button
        type="button"
        onClick={emailPurchase}
        disabled={busy || !vendorEmail}
        className="afs-icon-btn mail"
        title={vendorEmail ? "Email purchase bill PDF" : "No email on file"}
      >
        <MailIcon />
      </button>
      {archived ? (
        <button type="button" onClick={restore} disabled={busy} className="afs-btn" style={{ background: "#e5e7eb", color: "#333" }}>
          Restore
        </button>
      ) : (
        <button type="button" onClick={() => setShowArchiveDialog(true)} disabled={busy} className="afs-btn" style={{ background: "#e5e7eb", color: "#333" }}>
          Archive
        </button>
      )}
      {error && <span style={{ color: "#b91c1c", fontSize: 12 }}>{error}</span>}
      {notice && <span style={{ color: "#0ca30c", fontSize: 12 }}>{notice}</span>}

      {showArchiveDialog && (
        <ArchiveConfirmDialog
          title="Delete purchase bill"
          itemLabel={`purchase bill ${purchaseNumber}`}
          busy={busy}
          error={archiveError}
          onConfirm={confirmArchive}
          onCancel={() => setShowArchiveDialog(false)}
        />
      )}
    </div>
  );
}
