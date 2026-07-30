"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { RestoreIcon } from "@/components/icons";

export default function RestoreInvoiceButton({ invoiceId }: { invoiceId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function restore() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/invoices/${invoiceId}/restore`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to restore invoice");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to restore invoice");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <button type="button" onClick={restore} disabled={busy} className="afs-icon-btn success" title="Restore to Invoices">
        <RestoreIcon />
      </button>
      {error && <span style={{ color: "#b91c1c", fontSize: 11 }}>{error}</span>}
    </div>
  );
}
