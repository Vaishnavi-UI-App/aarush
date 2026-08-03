"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

interface Vendor {
  id: string;
  name: string;
  stateCode: string;
}

interface Item {
  id: string;
  name: string;
  hsnCode: string;
  unit: string;
  purchasePrice: number;
  taxRate: number;
}

interface Line {
  itemId: string;
  description: string;
  hsnCode: string;
  qty: string;
  rate: string;
  taxRate: string;
}

function emptyLine(): Line {
  return { itemId: "", description: "", hsnCode: "", qty: "1", rate: "0", taxRate: "18" };
}

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export default function CreatePurchaseForm({
  tenantStateCode,
  vendors,
  items,
  defaultVendorId,
}: {
  tenantStateCode: string;
  vendors: Vendor[];
  items: Item[];
  defaultVendorId?: string;
}) {
  const router = useRouter();
  const [vendorId, setVendorId] = useState(defaultVendorId ?? vendors[0]?.id ?? "");
  const [lines, setLines] = useState<Line[]>([emptyLine()]);
  const [discount, setDiscount] = useState("0");
  const [dueDate, setDueDate] = useState("");
  const [vendorBillNumber, setVendorBillNumber] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const vendor = vendors.find((v) => v.id === vendorId);
  const sameState = vendor ? vendor.stateCode === tenantStateCode : true;

  function updateLine(index: number, patch: Partial<Line>) {
    setLines((ls) => ls.map((l, i) => (i === index ? { ...l, ...patch } : l)));
  }

  function pickItem(index: number, itemId: string) {
    const item = items.find((i) => i.id === itemId);
    if (!item) {
      updateLine(index, { itemId: "" });
      return;
    }
    updateLine(index, {
      itemId,
      description: item.name,
      hsnCode: item.hsnCode,
      rate: item.purchasePrice.toString(),
      taxRate: item.taxRate.toString(),
    });
  }

  function addLine() {
    setLines((ls) => [...ls, emptyLine()]);
  }

  function removeLine(index: number) {
    setLines((ls) => ls.filter((_, i) => i !== index));
  }

  const totals = useMemo(() => {
    let subtotal = 0;
    let tax = 0;
    for (const l of lines) {
      const qty = Number(l.qty) || 0;
      const rate = Number(l.rate) || 0;
      const taxRate = Number(l.taxRate) || 0;
      const taxable = round2(qty * rate);
      subtotal += taxable;
      tax += round2((taxable * taxRate) / 100);
    }
    subtotal = round2(subtotal);
    tax = round2(tax);
    const discountAmount = round2(Number(discount) || 0);
    const total = round2(subtotal - discountAmount + tax);
    return { subtotal, tax, discountAmount, total };
  }, [lines, discount]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/purchases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vendorId,
          discount: Number(discount) || 0,
          dueDate: dueDate || undefined,
          vendorBillNumber: vendorBillNumber || undefined,
          lines: lines.map((l) => ({
            itemId: l.itemId || undefined,
            description: l.description,
            hsnCode: l.hsnCode,
            qty: Number(l.qty),
            rate: Number(l.rate),
            taxRate: Number(l.taxRate),
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create purchase bill");
      router.push(`/purchases/${data.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create purchase bill");
    } finally {
      setSaving(false);
    }
  }

  if (vendors.length === 0) {
    return <div className="afs-empty">Add a vendor first before creating a purchase bill.</div>;
  }

  return (
    <form onSubmit={onSubmit}>
      <div className="afs-form-row">
        <div className="afs-form-field">
          <label>Vendor *</label>
          <select value={vendorId} onChange={(e) => setVendorId(e.target.value)} required>
            {vendors.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name} (state {v.stateCode})
              </option>
            ))}
          </select>
        </div>
        <div className="afs-form-field">
          <label>Discount (Rs.)</label>
          <input type="number" min="0" step="0.01" value={discount} onChange={(e) => setDiscount(e.target.value)} />
        </div>
        <div className="afs-form-field">
          <label>Tax treatment</label>
          <input readOnly value={sameState ? "CGST + SGST (same state)" : "IGST (different state)"} />
        </div>
      </div>
      <div className="afs-form-row">
        <div className="afs-form-field">
          <label>Vendor&apos;s bill number</label>
          <input
            placeholder="e.g. their invoice #INV-4521"
            value={vendorBillNumber}
            onChange={(e) => setVendorBillNumber(e.target.value)}
          />
        </div>
        <div className="afs-form-field">
          <label>Due date</label>
          <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
        </div>
      </div>

      <table className="afs-table" style={{ marginTop: 10, marginBottom: 10 }}>
        <thead>
          <tr>
            <th style={{ width: 28 }}></th>
            <th>Item</th>
            <th>Description</th>
            <th>HSN/SAC</th>
            <th style={{ width: 70 }}>Qty</th>
            <th style={{ width: 100 }}>Rate</th>
            <th style={{ width: 90 }}>Tax %</th>
            <th style={{ width: 100 }}>Taxable</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((line, idx) => {
            const taxable = round2((Number(line.qty) || 0) * (Number(line.rate) || 0));
            return (
              <tr key={idx}>
                <td>
                  {lines.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeLine(idx)}
                      title="Remove line"
                      style={{ color: "#b91c1c", border: "none", background: "none", cursor: "pointer", fontSize: 16, lineHeight: 1 }}
                    >
                      ✕
                    </button>
                  )}
                </td>
                <td>
                  <select value={line.itemId} onChange={(e) => pickItem(idx, e.target.value)}>
                    <option value="">— manual —</option>
                    {items.map((i) => (
                      <option key={i.id} value={i.id}>
                        {i.name}
                      </option>
                    ))}
                  </select>
                </td>
                <td>
                  <input
                    required
                    value={line.description}
                    onChange={(e) => updateLine(idx, { description: e.target.value })}
                  />
                </td>
                <td>
                  <input required value={line.hsnCode} onChange={(e) => updateLine(idx, { hsnCode: e.target.value })} />
                </td>
                <td>
                  <input
                    required
                    type="number"
                    min="0.001"
                    step="0.001"
                    value={line.qty}
                    onChange={(e) => updateLine(idx, { qty: e.target.value })}
                  />
                </td>
                <td>
                  <input
                    required
                    type="number"
                    min="0"
                    step="0.01"
                    value={line.rate}
                    onChange={(e) => updateLine(idx, { rate: e.target.value })}
                  />
                </td>
                <td>
                  <input
                    required
                    type="number"
                    min="0"
                    step="0.01"
                    value={line.taxRate}
                    onChange={(e) => updateLine(idx, { taxRate: e.target.value })}
                  />
                </td>
                <td>{taxable.toFixed(2)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <button type="button" onClick={addLine} className="afs-btn afs-btn-gold" style={{ marginBottom: 20 }}>
        + Add line
      </button>

      <div className="afs-card" style={{ background: "#f8f9fd", maxWidth: 320, marginLeft: "auto", marginBottom: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 6 }}>
          <span>Subtotal</span>
          <span>Rs. {totals.subtotal.toFixed(2)}</span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 6 }}>
          <span>Discount</span>
          <span>- Rs. {totals.discountAmount.toFixed(2)}</span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 6 }}>
          <span>{sameState ? "CGST + SGST" : "IGST"}</span>
          <span>Rs. {totals.tax.toFixed(2)}</span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 16, fontWeight: 700, borderTop: "1px solid #ddd", paddingTop: 8 }}>
          <span>Total</span>
          <span>Rs. {totals.total.toFixed(2)}</span>
        </div>
      </div>

      {error && <div style={{ color: "#b91c1c", fontSize: 13, marginBottom: 12 }}>{error}</div>}

      <button type="submit" disabled={saving} className="afs-btn afs-btn-primary">
        {saving ? "Creating…" : "Create Purchase Bill"}
      </button>
    </form>
  );
}
