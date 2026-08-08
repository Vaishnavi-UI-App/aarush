"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { TrashIcon } from "@/components/icons";

export default function DeleteItemButton({ itemId, itemName }: { itemId: string; itemName: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function deleteItem() {
    if (!window.confirm(`Delete "${itemName}"? It stays on any invoice/purchase it's already used on, but won't show up when creating new ones.`)) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/items/${itemId}/archive`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to delete item");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete item");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <button type="button" onClick={deleteItem} disabled={busy} title="Delete item" className="afs-icon-btn danger">
        <TrashIcon />
      </button>
      {error && <span style={{ color: "#b91c1c", fontSize: 11 }}>{error}</span>}
    </div>
  );
}
