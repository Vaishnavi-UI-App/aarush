"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { TrashIcon } from "@/components/icons";

export default function DeletePaymentButton({
  customerId,
  paymentId,
  onDeleted,
}: {
  customerId: string;
  paymentId: string;
  /** Called after a successful delete, in addition to router.refresh() -- the
   * inline ledger modal on Banking needs this to re-fetch its own client-side
   * data, since router.refresh() only revalidates the current route's server data. */
  onDeleted?: () => void;
}) {
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
      onDeleted?.();
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
