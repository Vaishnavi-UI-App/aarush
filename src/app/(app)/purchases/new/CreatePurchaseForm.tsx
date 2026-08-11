"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { TrashIcon } from "@/components/icons";
import { COMMON_UNITS } from "@/lib/units";

interface Vendor {
  id: string;
  name: string;
  stateCode: string;
}

interface Site {
  id: string;
  name: string;
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

export interface PurchaseFormInitialValues {
  discount: string;
  dueDate: string;
  vendorBillNumber: string;
  siteId: string;
  lines: Line[];
}

export default function CreatePurchaseForm({
  tenantStateCode,
  vendors,
  items: initialItems,
  defaultVendorId,
  sites,
  editPurchaseId,
  initialValues,
}: {
  tenantStateCode: string;
  vendors: Vendor[];
  items: Item[];
  defaultVendorId?: string;
  sites: Site[];
  /** When set, the form edits this existing purchase bill (PATCH) instead of creating a
   * new one. The vendor can't be changed on edit -- it's already posted to that vendor's
   * ledger and stock has already moved against it. */
  editPurchaseId?: string;
  initialValues?: PurchaseFormInitialValues;
}) {
  const router = useRouter();
  const isEdit = !!editPurchaseId;
  const [vendorId, setVendorId] = useState(defaultVendorId ?? vendors[0]?.id ?? "");
  const [items, setItems] = useState<Item[]>(initialItems);
  const [lines, setLines] = useState<Line[]>(initialValues?.lines ?? [emptyLine(), emptyLine(), emptyLine(), emptyLine()]);
  const [discount, setDiscount] = useState(initialValues?.discount ?? "0");
  const [dueDate, setDueDate] = useState(initialValues?.dueDate ?? "");
  const [vendorBillNumber, setVendorBillNumber] = useState(initialValues?.vendorBillNumber ?? "");
  const [siteId, setSiteId] = useState(initialValues?.siteId ?? "");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [showNewItemForm, setShowNewItemForm] = useState(false);
  const [newItem, setNewItem] = useState({ name: "", hsnCode: "", unit: "NOS", purchasePrice: "", taxRate: "18" });
  const [newItemError, setNewItemError] = useState<string | null>(null);
  const [savingNewItem, setSavingNewItem] = useState(false);

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

  function setNewItemField<K extends keyof typeof newItem>(key: K, value: string) {
    setNewItem((f) => ({ ...f, [key]: value }));
  }

  function cancelNewItem() {
    setShowNewItemForm(false);
    setNewItem({ name: "", hsnCode: "", unit: "NOS", purchasePrice: "", taxRate: "18" });
    setNewItemError(null);
  }

  async function addItem() {
    if (!newItem.name || !newItem.hsnCode || !newItem.unit || newItem.purchasePrice === "") {
      setNewItemError("Name, HSN/SAC, Unit and Purchase price are required");
      return;
    }
    setSavingNewItem(true);
    setNewItemError(null);
    try {
      const res = await fetch("/api/items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newItem.name,
          hsnCode: newItem.hsnCode,
          unit: newItem.unit,
          // The catalog requires a sale price too -- default it to the purchase price
          // just entered so this doesn't block adding the item; adjust the real sale
          // price later from the Items page.
          salePrice: Number(newItem.purchasePrice),
          purchasePrice: Number(newItem.purchasePrice),
          taxRate: Number(newItem.taxRate),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create item");
      const created: Item = {
        id: data.id,
        name: data.name,
        hsnCode: data.hsnCode,
        unit: data.unit,
        purchasePrice: Number(data.purchasePrice ?? data.salePrice),
        taxRate: Number(data.taxRate),
      };
      setItems((its) => [...its, created].sort((a, b) => a.name.localeCompare(b.name)));
      cancelNewItem();
      router.refresh();
    } catch (e) {
      setNewItemError(e instanceof Error ? e.message : "Failed to create item");
    } finally {
      setSavingNewItem(false);
    }
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
      const body: Record<string, unknown> = {
        discount: Number(discount) || 0,
        dueDate: dueDate || undefined,
        vendorBillNumber: vendorBillNumber || undefined,
        siteId: siteId || undefined,
        lines: lines.map((l) => ({
          itemId: l.itemId || undefined,
          description: l.description,
          hsnCode: l.hsnCode,
          qty: Number(l.qty),
          rate: Number(l.rate),
          taxRate: Number(l.taxRate),
        })),
      };
      if (!isEdit) {
        body.vendorId = vendorId;
      }

      const res = await fetch(isEdit ? `/api/purchases/${editPurchaseId}` : "/api/purchases", {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Failed to ${isEdit ? "update" : "create"} purchase bill`);
      router.push(`/purchases/${isEdit ? editPurchaseId : data.id}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : `Failed to ${isEdit ? "update" : "create"} purchase bill`);
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
          {isEdit ? (
            <input readOnly value={vendors.find((v) => v.id === vendorId)?.name ?? ""} title="Vendor can't be changed once a bill is recorded" />
          ) : (
            <select value={vendorId} onChange={(e) => setVendorId(e.target.value)} required>
              {vendors.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name} (state {v.stateCode})
                </option>
              ))}
            </select>
          )}
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
        <div className="afs-form-field">
          <label>Site</label>
          <select value={siteId} onChange={(e) => setSiteId(e.target.value)}>
            <option value="">— none —</option>
            {sites.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <table className="afs-table" style={{ marginTop: 10, marginBottom: 10 }}>
        <thead>
          <tr>
            <th>Item</th>
            <th>Description</th>
            <th>HSN/SAC</th>
            <th style={{ width: 70 }}>Qty</th>
            <th style={{ width: 100 }}>Rate</th>
            <th style={{ width: 90 }}>Tax %</th>
            <th style={{ width: 100 }}>Taxable</th>
            <th style={{ width: 40, position: "sticky", right: 0, background: "#f2f4fa" }}></th>
          </tr>
        </thead>
        <tbody>
          {lines.map((line, idx) => {
            const taxable = round2((Number(line.qty) || 0) * (Number(line.rate) || 0));
            return (
              <tr key={idx}>
                <td data-label="Item">
                  <select value={line.itemId} onChange={(e) => pickItem(idx, e.target.value)}>
                    <option value="">— manual —</option>
                    {items.map((i) => (
                      <option key={i.id} value={i.id}>
                        {i.name}
                      </option>
                    ))}
                  </select>
                </td>
                <td data-label="Description">
                  <input
                    required
                    value={line.description}
                    onChange={(e) => updateLine(idx, { description: e.target.value })}
                  />
                </td>
                <td data-label="HSN/SAC">
                  <input required value={line.hsnCode} onChange={(e) => updateLine(idx, { hsnCode: e.target.value })} />
                </td>
                <td data-label="Qty">
                  <input
                    required
                    type="number"
                    min="0.001"
                    step="0.001"
                    value={line.qty}
                    onChange={(e) => updateLine(idx, { qty: e.target.value })}
                  />
                </td>
                <td data-label="Rate">
                  <input
                    required
                    type="number"
                    min="0"
                    step="0.01"
                    value={line.rate}
                    onChange={(e) => updateLine(idx, { rate: e.target.value })}
                  />
                </td>
                <td data-label="Tax %">
                  <input
                    required
                    type="number"
                    min="0"
                    step="0.01"
                    value={line.taxRate}
                    onChange={(e) => updateLine(idx, { taxRate: e.target.value })}
                  />
                </td>
                <td data-label="Taxable">{taxable.toFixed(2)}</td>
                <td style={{ position: "sticky", right: 0, background: "#fff", zIndex: 1 }}>
                  <button
                    type="button"
                    onClick={() => removeLine(idx)}
                    title="Delete line"
                    className="afs-icon-btn danger"
                  >
                    <TrashIcon />
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <div style={{ display: "flex", gap: 10, marginBottom: 20 }}>
        <button type="button" onClick={addLine} className="afs-btn afs-btn-gold">
          + Add line
        </button>
        <button type="button" onClick={() => setShowNewItemForm((v) => !v)} className="afs-btn" style={{ background: "#e5e7eb", color: "#333" }}>
          + Add Item
        </button>
      </div>

      {showNewItemForm && (
        <div className="afs-card" style={{ background: "#f8f9fd", marginBottom: 20 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: "#445" }}>New Item</div>
            <button type="button" onClick={cancelNewItem} title="Cancel" className="afs-icon-btn danger">
              <TrashIcon />
            </button>
          </div>
          <div className="afs-form-row">
            <div className="afs-form-field">
              <label>Name *</label>
              <input required value={newItem.name} onChange={(e) => setNewItemField("name", e.target.value)} />
            </div>
            <div className="afs-form-field">
              <label>HSN/SAC *</label>
              <input required value={newItem.hsnCode} onChange={(e) => setNewItemField("hsnCode", e.target.value)} />
            </div>
            <div className="afs-form-field">
              <label>Unit *</label>
              <select required value={newItem.unit} onChange={(e) => setNewItemField("unit", e.target.value)}>
                {COMMON_UNITS.map((u) => (
                  <option key={u} value={u}>
                    {u}
                  </option>
                ))}
              </select>
            </div>
            <div className="afs-form-field">
              <label>Purchase price *</label>
              <input
                required
                type="number"
                step="0.01"
                min="0"
                value={newItem.purchasePrice}
                onChange={(e) => setNewItemField("purchasePrice", e.target.value)}
              />
            </div>
            <div className="afs-form-field">
              <label>Tax rate % *</label>
              <select required value={newItem.taxRate} onChange={(e) => setNewItemField("taxRate", e.target.value)}>
                {[0, 5, 12, 18, 28].map((r) => (
                  <option key={r} value={r}>
                    {r}%
                  </option>
                ))}
              </select>
            </div>
          </div>
          {newItemError && <div style={{ color: "#b91c1c", fontSize: 13, marginBottom: 10 }}>{newItemError}</div>}
          <button type="button" onClick={addItem} disabled={savingNewItem} className="afs-btn afs-btn-primary">
            {savingNewItem ? "Adding…" : "Save Item"}
          </button>
        </div>
      )}

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
        {isEdit ? (saving ? "Saving…" : "Save Changes") : saving ? "Creating…" : "Create Purchase Bill"}
      </button>
    </form>
  );
}
