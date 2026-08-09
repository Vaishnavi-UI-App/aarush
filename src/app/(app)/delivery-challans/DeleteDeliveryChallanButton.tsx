"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { TrashIcon } from "@/components/icons";

export default function DeleteDeliveryChallanButton({ challanId, challanNumber }: { challanId: string; challanNumber: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function deleteChallan() {
    if (!window.confirm(`Delete delivery challan ${challanNumber}? This can't be undone.`)) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/delivery-challans/${challanId}/archive`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to delete delivery challan");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete delivery challan");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <button type="button" onClick={deleteChallan} disabled={busy} title="Delete delivery challan" className="afs-icon-btn danger">
        <TrashIcon />
      </button>
      {error && <span style={{ color: "#b91c1c", fontSize: 11 }}>{error}</span>}
    </div>
  );
}
