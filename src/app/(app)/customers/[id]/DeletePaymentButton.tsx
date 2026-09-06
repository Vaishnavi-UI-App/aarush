"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { TrashIcon } from "@/components/icons";

export default function DeletePaymentButton({ customerId, paymentId }: { customerId: string; paymentId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function deletePayment() {
    if (!window.confirm("Delete this payment entry? This only corrects the books -- it does not refund any money. This can't be undone.")) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/customers/${customerId}/payments/${paymentId}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to delete payment");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete payment");
      setBusy(false);
    }
  }

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <button type="button" onClick={deletePayment} disabled={busy} title="Delete payment entry" className="afs-icon-btn danger">
        <TrashIcon />
      </button>
      {error && <span style={{ color: "#b91c1c", fontSize: 11 }}>{error}</span>}
    </div>
  );
}
