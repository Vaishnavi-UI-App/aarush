"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { RestoreIcon } from "@/components/icons";

export default function RestorePurchaseButton({ purchaseId }: { purchaseId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function restore() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/purchases/${purchaseId}/restore`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to restore purchase bill");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to restore purchase bill");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <button type="button" onClick={restore} disabled={busy} className="afs-icon-btn success" title="Restore to Purchases">
        <RestoreIcon />
      </button>
      {error && <span style={{ color: "#b91c1c", fontSize: 11 }}>{error}</span>}
    </div>
  );
}
