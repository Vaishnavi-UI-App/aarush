"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { COMMON_UNITS } from "@/lib/units";
import { EditIcon } from "@/components/icons";
import DeleteItemButton from "./DeleteItemButton";

interface Item {
  id: string;
  name: string;
  description: string | null;
  hsnCode: string;
  unit: string;
  salePrice: number;
  taxRate: number;
  currentStock: number;
}

export default function EditableItemRow({ item }: { item: Item }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    name: item.name,
    description: item.description ?? "",
    hsnCode: item.hsnCode,
    unit: item.unit,
    salePrice: item.salePrice.toString(),
    taxRate: item.taxRate.toString(),
  });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function set<K extends keyof typeof form>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function cancel() {
    setForm({
      name: item.name,
      description: item.description ?? "",
      hsnCode: item.hsnCode,
      unit: item.unit,
      salePrice: item.salePrice.toString(),
      taxRate: item.taxRate.toString(),
    });
    setError(null);
    setEditing(false);
  }

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/items/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          description: form.description,
          hsnCode: form.hsnCode,
          unit: form.unit,
          salePrice: Number(form.salePrice),
          taxRate: Number(form.taxRate),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save item");
      setEditing(false);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save item");
    } finally {
      setSaving(false);
    }
  }

  if (editing) {
    return (
      <tr>
        <td data-label="Name">
          <input value={form.name} onChange={(e) => set("name", e.target.value)} />
        </td>
        <td data-label="Description">
          <input value={form.description} onChange={(e) => set("description", e.target.value)} placeholder="Optional spec/detail" />
        </td>
        <td data-label="HSN/SAC">
          <input value={form.hsnCode} onChange={(e) => set("hsnCode", e.target.value)} />
        </td>
        <td data-label="Unit">
          <select value={form.unit} onChange={(e) => set("unit", e.target.value)}>
            {COMMON_UNITS.map((u) => (
              <option key={u} value={u}>
                {u}
              </option>
            ))}
          </select>
        </td>
        <td data-label="Sale price">
          <input type="number" step="0.01" min="0" value={form.salePrice} onChange={(e) => set("salePrice", e.target.value)} />
        </td>
        <td data-label="Tax rate">
          <select value={form.taxRate} onChange={(e) => set("taxRate", e.target.value)}>
            {[0, 5, 12, 18, 28].map((r) => (
              <option key={r} value={r}>
                {r}%
              </option>
            ))}
          </select>
        </td>
        <td data-label="Stock on hand">
          {item.currentStock <= 0 ? <span className="afs-badge afs-badge-overdue">Out of stock</span> : `${item.currentStock} ${item.unit}`}
        </td>
        <td>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <button type="button" onClick={save} disabled={saving} className="afs-btn afs-btn-primary" style={{ padding: "4px 10px", fontSize: 12 }}>
              {saving ? "Saving…" : "Save"}
            </button>
            <button type="button" onClick={cancel} disabled={saving} className="afs-btn" style={{ padding: "4px 10px", fontSize: 12, background: "#e5e7eb", color: "#333" }}>
              Cancel
            </button>
            {error && <span style={{ color: "#b91c1c", fontSize: 11 }}>{error}</span>}
          </div>
        </td>
      </tr>
    );
  }

  return (
    <tr>
      <td data-label="Name">{item.name}</td>
      <td data-label="Description" style={{ color: item.description ? undefined : "#aab" }}>
        {item.description || "—"}
      </td>
      <td data-label="HSN/SAC">{item.hsnCode}</td>
      <td data-label="Unit">{item.unit}</td>
      <td data-label="Sale price">Rs. {item.salePrice.toFixed(2)}</td>
      <td data-label="Tax rate">{item.taxRate.toFixed(2)}%</td>
      <td data-label="Stock on hand">
        {item.currentStock <= 0 ? <span className="afs-badge afs-badge-overdue">Out of stock</span> : `${item.currentStock} ${item.unit}`}
      </td>
      <td>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button type="button" onClick={() => setEditing(true)} title="Edit item" className="afs-icon-btn edit">
            <EditIcon />
          </button>
          <DeleteItemButton itemId={item.id} itemName={item.name} />
        </div>
      </td>
    </tr>
  );
}
