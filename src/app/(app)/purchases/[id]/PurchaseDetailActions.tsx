"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function PurchaseDetailActions({ purchaseId, archived }: { purchaseId: string; archived: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function toggleArchive() {
    const action = archived ? "restore" : "archive";
    if (!archived && !window.confirm("Move this purchase bill to Archive? You can restore it later.")) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/purchases/${purchaseId}/${action}`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Failed to ${action}`);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : `Failed to ${action}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <a href={`/api/purchases/${purchaseId}/pdf`} target="_blank" rel="noopener noreferrer" className="afs-btn afs-btn-primary">
        ⬇ Download PDF
      </a>
      <button type="button" onClick={toggleArchive} disabled={busy} className="afs-btn" style={{ background: "#e5e7eb", color: "#333" }}>
        {archived ? "Restore" : "Archive"}
      </button>
      {error && <span style={{ color: "#b91c1c", fontSize: 12 }}>{error}</span>}
    </div>
  );
}
