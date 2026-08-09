"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { TrashIcon } from "@/components/icons";

export default function DeleteCustomerButton({ customerId, customerName }: { customerId: string; customerName: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function deleteCustomer() {
    if (
      !window.confirm(
        `Delete "${customerName}"? Their existing invoices, delivery challans, and ledger history stay exactly as they are -- this only hides them from customer pickers when creating new documents.`
      )
    )
      return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/customers/${customerId}/archive`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to delete customer");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete customer");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <button type="button" onClick={deleteCustomer} disabled={busy} title="Delete customer" className="afs-icon-btn danger">
        <TrashIcon />
      </button>
      {error && <span style={{ color: "#b91c1c", fontSize: 11 }}>{error}</span>}
    </div>
  );
}
