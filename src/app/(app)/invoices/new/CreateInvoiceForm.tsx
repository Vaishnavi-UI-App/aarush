"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { COMMON_UNITS } from "@/lib/units";

interface Customer {
  id: string;
  name: string;
  stateCode: string;
}

interface Item {
  id: string;
  name: string;
  hsnCode: string;
  unit: string;
  salePrice: number;
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

export default function CreateInvoiceForm({
  type,
  tenantStateCode,
  customers,
  items: initialItems,
  defaultCustomerId,
}: {
  type: "SALE" | "PROFORMA";
  tenantStateCode: string;
  customers: Customer[];
  items: Item[];
  defaultCustomerId?: string;
}) {
  const router = useRouter();
  const [customerId, setCustomerId] = useState(defaultCustomerId ?? customers[0]?.id ?? "");
  const [items, setItems] = useState<Item[]>(initialItems);
  const [lines, setLines] = useState<Line[]>([emptyLine()]);
  const [discount, setDiscount] = useState("0");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [showNewItemForm, setShowNewItemForm] = useState(false);
  const [newItem, setNewItem] = useState({ name: "", hsnCode: "", unit: "NOS", salePrice: "", taxRate: "18" });
  const [newItemError, setNewItemError] = useState<string | null>(null);
  const [savingNewItem, setSavingNewItem] = useState(false);

  const [poNumber, setPoNumber] = useState("");
  const [poDate, setPoDate] = useState("");
  const [vehicleNumber, setVehicleNumber] = useState("");
  const [transportationMode, setTransportationMode] = useState("");
  const [reverseCharge, setReverseCharge] = useState(false);
  const [deliveredThrough, setDeliveredThrough] = useState("");
  const [placeOfSupplySite, setPlaceOfSupplySite] = useState("");

  const [shipToSameAsBilling, setShipToSameAsBilling] = useState(true);
  const [shipToName, setShipToName] = useState("");
  const [shipToAddress, setShipToAddress] = useState("");
  const [shipToGstin, setShipToGstin] = useState("");
  const [shipToStateCode, setShipToStateCode] = useState("");

  const customer = customers.find((c) => c.id === customerId);
  const sameState = customer ? customer.stateCode === tenantStateCode : true;

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
      rate: item.salePrice.toString(),
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

  async function addItem() {
    if (!newItem.name || !newItem.hsnCode || !newItem.unit || newItem.salePrice === "") {
      setNewItemError("Name, HSN/SAC, Unit and Sale price are required");
      return;
    }
    setSavingNewItem(true);
    setNewItemError(null);
    try {
      const res = await fetch("/api/items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...newItem,
          salePrice: Number(newItem.salePrice),
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
        salePrice: Number(data.salePrice),
        taxRate: Number(data.taxRate),
      };
      setItems((its) => [...its, created].sort((a, b) => a.name.localeCompare(b.name)));
      setNewItem({ name: "", hsnCode: "", unit: "NOS", salePrice: "", taxRate: "18" });
      setShowNewItemForm(false);
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
      const res = await fetch("/api/invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId,
          type,
          discount: Number(discount) || 0,
          poNumber: poNumber || undefined,
          poDate: poDate || undefined,
          vehicleNumber: vehicleNumber || undefined,
          transportationMode: transportationMode || undefined,
          reverseCharge,
          deliveredThrough: deliveredThrough || undefined,
          placeOfSupplySite: placeOfSupplySite || undefined,
          shipToSameAsBilling,
          shipToName: shipToSameAsBilling ? undefined : shipToName || undefined,
          shipToAddress: shipToSameAsBilling ? undefined : shipToAddress || undefined,
          shipToGstin: shipToSameAsBilling ? undefined : shipToGstin || undefined,
          shipToStateCode: shipToSameAsBilling ? undefined : shipToStateCode || undefined,
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
      if (!res.ok) throw new Error(data.error || "Failed to create invoice");
      router.push(`/invoices/${data.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create invoice");
    } finally {
      setSaving(false);
    }
  }

  if (customers.length === 0) {
    return <div className="afs-empty">Add a customer first before creating an invoice.</div>;
  }

  return (
    <form onSubmit={onSubmit}>
      <div className="afs-form-row">
        <div className="afs-form-field">
          <label>Customer *</label>
          <select value={customerId} onChange={(e) => setCustomerId(e.target.value)} required>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} (state {c.stateCode})
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
          <label>PO Number</label>
          <input value={poNumber} onChange={(e) => setPoNumber(e.target.value)} />
        </div>
        <div className="afs-form-field">
          <label>PO Date</label>
          <input type="date" value={poDate} onChange={(e) => setPoDate(e.target.value)} />
        </div>
        <div className="afs-form-field">
          <label>Reverse Charge</label>
          <select value={reverseCharge ? "YES" : "NO"} onChange={(e) => setReverseCharge(e.target.value === "YES")}>
            <option value="NO">NO</option>
            <option value="YES">YES</option>
          </select>
        </div>
      </div>

      <div className="afs-form-row">
        <div className="afs-form-field">
          <label>Vehicle Number</label>
          <input value={vehicleNumber} onChange={(e) => setVehicleNumber(e.target.value)} />
        </div>
        <div className="afs-form-field">
          <label>Transportation Mode</label>
          <input value={transportationMode} onChange={(e) => setTransportationMode(e.target.value)} />
        </div>
        <div className="afs-form-field">
          <label>Delivered Through</label>
          <input value={deliveredThrough} onChange={(e) => setDeliveredThrough(e.target.value)} />
        </div>
      </div>

      <div className="afs-form-row">
        <div className="afs-form-field">
          <label>Place of Supply (site)</label>
          <input value={placeOfSupplySite} onChange={(e) => setPlaceOfSupplySite(e.target.value)} />
        </div>
      </div>

      <div className="afs-form-field" style={{ marginBottom: 10 }}>
        <label style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 400 }}>
          <input
            type="checkbox"
            checked={shipToSameAsBilling}
            onChange={(e) => setShipToSameAsBilling(e.target.checked)}
          />
          Shipped to same address as billing
        </label>
      </div>

      {!shipToSameAsBilling && (
        <>
          <div className="afs-form-row">
            <div className="afs-form-field">
              <label>Consignee Name</label>
              <input value={shipToName} onChange={(e) => setShipToName(e.target.value)} />
            </div>
            <div className="afs-form-field">
              <label>Consignee GSTIN</label>
              <input value={shipToGstin} onChange={(e) => setShipToGstin(e.target.value)} />
            </div>
            <div className="afs-form-field">
              <label>Consignee State code</label>
              <input value={shipToStateCode} onChange={(e) => setShipToStateCode(e.target.value)} maxLength={2} />
            </div>
          </div>
          <div className="afs-form-row">
            <div className="afs-form-field">
              <label>Consignee Address</label>
              <input value={shipToAddress} onChange={(e) => setShipToAddress(e.target.value)} />
            </div>
          </div>
        </>
      )}

      <table className="afs-table" style={{ marginTop: 10, marginBottom: 10 }}>
        <thead>
          <tr>
            <th style={{ width: 28, position: "sticky", left: 0, background: "#f2f4fa", zIndex: 1 }}></th>
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
                <td style={{ position: "sticky", left: 0, background: "#fff", zIndex: 1 }}>
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
              <label>Sale price *</label>
              <input
                required
                type="number"
                step="0.01"
                min="0"
                value={newItem.salePrice}
                onChange={(e) => setNewItemField("salePrice", e.target.value)}
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
        {saving ? "Creating…" : type === "PROFORMA" ? "Create Proforma Invoice" : "Create Sale Invoice"}
      </button>
    </form>
  );
}
