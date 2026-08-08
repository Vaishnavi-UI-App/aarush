"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export interface EditableFund {
  id: string;
  amount: string;
  note: string | null;
}

export default function EditFundModal({ siteId, fund, onClose }: { siteId: string; fund: EditableFund; onClose: () => void }) {
  const router = useRouter();
  const [amount, setAmount] = useState(fund.amount);
  const [note, setNote] = useState(fund.note ?? "");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/sites/${siteId}/fund/${fund.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: Number(amount), note: note || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update fund");
      router.refresh();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to update fund");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="afs-modal-backdrop" onClick={onClose}>
      <div className="afs-modal" onClick={(e) => e.stopPropagation()}>
        <h2>Edit Fund</h2>
        <form onSubmit={onSubmit}>
          <div className="afs-form-field" style={{ marginBottom: 12 }}>
            <label>Amount *</label>
            <input required type="number" min="0.01" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </div>
          <div className="afs-form-field" style={{ marginBottom: 16 }}>
            <label>Note</label>
            <input value={note} onChange={(e) => setNote(e.target.value)} />
          </div>

          {error && <div style={{ color: "#b91c1c", fontSize: 13, marginBottom: 12 }}>{error}</div>}

          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
            <button type="button" onClick={onClose} disabled={saving} className="afs-btn" style={{ background: "#e5e7eb", color: "#333" }}>
              Cancel
            </button>
            <button type="submit" disabled={saving} className="afs-btn afs-btn-primary">
              {saving ? "Saving…" : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
