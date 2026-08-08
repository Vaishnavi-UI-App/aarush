"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Option {
  id: string;
  name: string;
}

export interface EditableExpense {
  id: string;
  date: string;
  amount: string;
  note: string | null;
  category: { id: string; name: string } | null;
  orderedBy: { id: string; name: string } | null;
}

export default function EditExpenseModal({
  expense,
  categories,
  orderedByPeople,
  onClose,
}: {
  expense: EditableExpense;
  categories: Option[];
  orderedByPeople: Option[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [amount, setAmount] = useState(expense.amount);
  const [categoryId, setCategoryId] = useState(expense.category?.id ?? "");
  const [orderedById, setOrderedById] = useState(expense.orderedBy?.id ?? "");
  const [date, setDate] = useState(new Date(expense.date).toISOString().slice(0, 10));
  const [note, setNote] = useState(expense.note ?? "");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/expenses/${expense.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: Number(amount),
          categoryId: categoryId || undefined,
          orderedById: orderedById || undefined,
          date,
          note: note || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update expense");
      router.refresh();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to update expense");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="afs-modal-backdrop" onClick={onClose}>
      <div className="afs-modal" onClick={(e) => e.stopPropagation()}>
        <h2>Edit Expense</h2>
        <form onSubmit={onSubmit}>
          <div className="afs-form-field" style={{ marginBottom: 12 }}>
            <label>Amount *</label>
            <input required type="number" min="0.01" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </div>
          <div className="afs-form-field" style={{ marginBottom: 12 }}>
            <label>Date</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div className="afs-form-field" style={{ marginBottom: 12 }}>
            <label>Category</label>
            <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
              <option value="">Uncategorized</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div className="afs-form-field" style={{ marginBottom: 12 }}>
            <label>Ordered by</label>
            <select value={orderedById} onChange={(e) => setOrderedById(e.target.value)}>
              <option value="">—</option>
              {orderedByPeople.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
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
