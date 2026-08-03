"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { resizePhotoToDataUrl } from "@/lib/capture";

interface Option {
  id: string;
  name: string;
}

const NEW_OPTION = "__new__";

export default function NewExpenseForm({
  sites,
  categories,
  orderedByPeople,
}: {
  sites: Option[];
  categories: Option[];
  orderedByPeople: Option[];
}) {
  const router = useRouter();
  const [siteId, setSiteId] = useState(sites[0]?.id ?? "");
  const [amount, setAmount] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [newCategory, setNewCategory] = useState("");
  const [orderedById, setOrderedById] = useState("");
  const [newOrderedBy, setNewOrderedBy] = useState("");
  const [note, setNote] = useState("");
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function resolveLookup(kind: "expense-categories" | "ordered-by-people", id: string, newName: string): Promise<string | undefined> {
    if (id !== NEW_OPTION) return id || undefined;
    if (!newName.trim()) return undefined;
    const res = await fetch(`/api/${kind}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName.trim() }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Failed to add option");
    return data.id;
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      if (!siteId) throw new Error("Choose a site");

      const [resolvedCategoryId, resolvedOrderedById, receiptPhotoData] = await Promise.all([
        resolveLookup("expense-categories", categoryId, newCategory),
        resolveLookup("ordered-by-people", orderedById, newOrderedBy),
        receiptFile ? resizePhotoToDataUrl(receiptFile) : Promise.resolve(undefined),
      ]);

      const res = await fetch("/api/expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          siteId,
          amount: Number(amount),
          categoryId: resolvedCategoryId,
          orderedById: resolvedOrderedById,
          note: note || undefined,
          receiptPhotoData,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to record expense");

      setNotice(
        data.fundType === "COMPANY"
          ? "Recorded -- fully covered by the site's company balance."
          : data.fundType === "SPLIT"
          ? `Recorded -- Rs. ${Number(data.companyPaid).toFixed(2)} from company balance, Rs. ${Number(data.personalPaid).toFixed(2)} personal.`
          : "Recorded -- paid personally (no company balance available)."
      );
      setAmount("");
      setNote("");
      setReceiptFile(null);
      setCategoryId("");
      setNewCategory("");
      setOrderedById("");
      setNewOrderedBy("");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to record expense");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={onSubmit}>
      <div className="afs-form-row">
        <div className="afs-form-field">
          <label>Site *</label>
          <select required value={siteId} onChange={(e) => setSiteId(e.target.value)}>
            <option value="" disabled>
              Choose a site
            </option>
            {sites.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
        <div className="afs-form-field">
          <label>Amount *</label>
          <input required type="number" min="0.01" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />
        </div>
        <div className="afs-form-field">
          <label>Category</label>
          <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
            <option value="">Uncategorized</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
            <option value={NEW_OPTION}>+ New category…</option>
          </select>
          {categoryId === NEW_OPTION && (
            <input placeholder="New category name" value={newCategory} onChange={(e) => setNewCategory(e.target.value)} style={{ marginTop: 6 }} />
          )}
        </div>
      </div>
      <div className="afs-form-row">
        <div className="afs-form-field">
          <label>Ordered by</label>
          <select value={orderedById} onChange={(e) => setOrderedById(e.target.value)}>
            <option value="">—</option>
            {orderedByPeople.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
            <option value={NEW_OPTION}>+ New person…</option>
          </select>
          {orderedById === NEW_OPTION && (
            <input placeholder="New person's name" value={newOrderedBy} onChange={(e) => setNewOrderedBy(e.target.value)} style={{ marginTop: 6 }} />
          )}
        </div>
        <div className="afs-form-field">
          <label>Note</label>
          <input value={note} onChange={(e) => setNote(e.target.value)} />
        </div>
        <div className="afs-form-field">
          <label>Receipt photo</label>
          <input type="file" accept="image/*" onChange={(e) => setReceiptFile(e.target.files?.[0] ?? null)} />
        </div>
      </div>
      {error && <div style={{ color: "#b91c1c", fontSize: 13, marginBottom: 10 }}>{error}</div>}
      {notice && <div style={{ color: "#0ca30c", fontSize: 13, marginBottom: 10 }}>{notice}</div>}
      <button type="submit" disabled={saving} className="afs-btn afs-btn-primary">
        {saving ? "Recording…" : "+ Add Expense"}
      </button>
    </form>
  );
}
