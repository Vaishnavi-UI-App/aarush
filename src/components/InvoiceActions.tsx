"use client";

import { useState } from "react";

type Status = { kind: "idle" } | { kind: "sending"; via: string } | { kind: "success"; via: string } | { kind: "error"; via: string; message: string };

export default function InvoiceActions({ defaultEmail, defaultPhone }: { defaultEmail?: string; defaultPhone?: string }) {
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  async function sendEmail() {
    const to = window.prompt("Send invoice to email address:", defaultEmail && defaultEmail !== "None" ? defaultEmail : "");
    if (!to) return;
    setStatus({ kind: "sending", via: "email" });
    try {
      const res = await fetch("/api/invoice/send-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to send email");
      setStatus({ kind: "success", via: "email" });
    } catch (e) {
      setStatus({ kind: "error", via: "email", message: e instanceof Error ? e.message : "Unknown error" });
    }
  }

  async function sendWhatsapp() {
    const to = window.prompt(
      "Send invoice via WhatsApp to (include country code, no + or spaces, e.g. 919545519101):",
      defaultPhone ?? ""
    );
    if (!to) return;
    setStatus({ kind: "sending", via: "whatsapp" });
    try {
      const res = await fetch("/api/invoice/send-whatsapp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to send WhatsApp message");
      setStatus({ kind: "success", via: "whatsapp" });
    } catch (e) {
      setStatus({ kind: "error", via: "whatsapp", message: e instanceof Error ? e.message : "Unknown error" });
    }
  }

  return (
    <div className="afs-actions-bar">
      <a href="/api/invoice/pdf" className="afs-btn afs-btn-primary">
        ⬇ Download PDF
      </a>
      <button onClick={sendEmail} disabled={status.kind === "sending"} className="afs-btn afs-btn-maroon">
        {status.kind === "sending" && status.via === "email" ? "Sending…" : "✉ Send via Email"}
      </button>
      <button onClick={sendWhatsapp} disabled={status.kind === "sending"} className="afs-btn afs-btn-gold">
        {status.kind === "sending" && status.via === "whatsapp" ? "Sending…" : "🟢 Send via WhatsApp"}
      </button>
      {status.kind === "success" && <span className="afs-status afs-status-success">Sent via {status.via} successfully.</span>}
      {status.kind === "error" && (
        <span className="afs-status afs-status-error">
          Failed ({status.via}): {status.message}
        </span>
      )}
    </div>
  );
}
