"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { COMMON_UNITS } from "@/lib/units";
import { TrashIcon } from "@/components/icons";

interface Customer {
  id: string;
  name: string;
  stateCode: string;
}

interface Site {
  id: string;
  name: string;
}

const PAYMENT_TERMS_OPTIONS = ["Due on Receipt", "Net 15", "Net 30", "Net 45", "Net 60", "Net 90"];

interface Item {
  id: string;
  name: string;
  description?: string;
  hsnCode: string;
  unit: string;
  salePrice: number;
  taxRate: number;
}

interface Line {
  itemId: string;
  /** Overrides the printed Sr.No -- see the schema comment on InvoiceLine.srNo. Carried
   * through untouched on every save; this form has no UI to edit it, so it must never be
   * dropped just because some *other* field on the invoice changed. */
  srNo?: number;
  /** What's typed/shown in the searchable item picker -- not sent to the server. Kept in
   * sync with itemId when a catalog item is picked, but free-typed otherwise so the field
   * doesn't fight the user while they're searching. */
  itemQuery: string;
  description: string;
  detail: string;
  hsnCode: string;
  unit: string;
  qty: string;
  rate: string;
  taxRate: string;
}

function emptyLine(): Line {
  return { itemId: "", itemQuery: "", description: "", detail: "", hsnCode: "", unit: "NOS", qty: "1", rate: "0", taxRate: "18" };
}

/**
 * The Item picker is the only visible input for a line's name/description now, so it must
 * never show blank for a line that already has one -- prefer the catalog's canonical name
 * when itemId resolves, otherwise fall back to whatever description text is already stored
 * (older/manual lines included), rather than leaving the field empty just because it isn't
 * linked to a catalog item.
 */
function resolveItemQuery(line: { itemId: string; description: string }, items: Item[]): string {
  if (line.itemId) {
    const byId = items.find((i) => i.id === line.itemId);
    if (byId) return byId.name;
  }
  return line.description;
}

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export interface InvoiceFormInitialValues {
  lines: Omit<Line, "itemQuery">[];
  /** Edit-only: the invoice's own date (YYYY-MM-DD). Not settable on create -- new
   * invoices are always dated today, see createSaleInvoiceInTx. */
  date?: string;
  discount: string;
  poNumber: string;
  poDate: string;
  vehicleNumber: string;
  transportationMode: string;
  reverseCharge: boolean;
  deliveredThrough: string;
  placeOfSupplySite: string;
  siteId: string;
  paymentTerms: string;
  shipToSameAsBilling: boolean;
  shipToName: string;
  shipToAddress: string;
  shipToGstin: string;
  shipToStateCode: string;
}

export default function CreateInvoiceForm({
  type,
  isServiceInvoice = false,
  tenantStateCode,
  customers,
  items: initialItems,
  defaultCustomerId,
  editInvoiceId,
  initialValues,
  sites: initialSites,
}: {
  type: "SALE" | "PROFORMA" | "QUOTATION";
  /** SALE only: same form/behavior as any other sale invoice, just prints "Service Tax
   * Invoice" instead of "Tax Invoice" -- see NewInvoicePage's ?service=1 query param. */
  isServiceInvoice?: boolean;
  tenantStateCode: string;
  customers: Customer[];
  items: Item[];
  defaultCustomerId?: string;
  /** When set, the form edits this existing invoice (PATCH) instead of creating a new one.
   * The customer can't be changed on edit -- it's already posted to that customer's ledger. */
  editInvoiceId?: string;
  initialValues?: InvoiceFormInitialValues;
  sites: Site[];
}) {
  const router = useRouter();
  const isEdit = !!editInvoiceId;
  const [customerId, setCustomerId] = useState(defaultCustomerId ?? customers[0]?.id ?? "");
  const [items, setItems] = useState<Item[]>(initialItems);
  const [lines, setLines] = useState<Line[]>(
    initialValues?.lines.map((l) => ({ ...l, itemQuery: resolveItemQuery(l, initialItems) })) ?? [emptyLine()],
  );
  const [date, setDate] = useState(initialValues?.date ?? "");
  const [discount, setDiscount] = useState(initialValues?.discount ?? "0");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [showNewItemForm, setShowNewItemForm] = useState(false);
  const [newItem, setNewItem] = useState({ name: "", description: "", hsnCode: "", unit: "NOS", salePrice: "", taxRate: "18" });
  const [newItemError, setNewItemError] = useState<string | null>(null);
  const [savingNewItem, setSavingNewItem] = useState(false);

  const [poNumber, setPoNumber] = useState(initialValues?.poNumber ?? "");
  const [poDate, setPoDate] = useState(initialValues?.poDate ?? "");
  const [vehicleNumber, setVehicleNumber] = useState(initialValues?.vehicleNumber ?? "");
  const [transportationMode, setTransportationMode] = useState(initialValues?.transportationMode ?? "");
  const [reverseCharge, setReverseCharge] = useState(initialValues?.reverseCharge ?? false);
  const [deliveredThrough, setDeliveredThrough] = useState(initialValues?.deliveredThrough ?? "");
  const [placeOfSupplySite, setPlaceOfSupplySite] = useState(initialValues?.placeOfSupplySite ?? "");
  const [sites, setSites] = useState<Site[]>(initialSites);
  const [siteId, setSiteId] = useState(initialValues?.siteId ?? "");
  const [showNewSiteForm, setShowNewSiteForm] = useState(false);
  const [newSiteName, setNewSiteName] = useState("");
  const [newSiteError, setNewSiteError] = useState<string | null>(null);
  const [savingNewSite, setSavingNewSite] = useState(false);
  const [paymentTerms, setPaymentTerms] = useState(initialValues?.paymentTerms ?? "");

  const [shipToSameAsBilling, setShipToSameAsBilling] = useState(initialValues?.shipToSameAsBilling ?? true);
  const [shipToName, setShipToName] = useState(initialValues?.shipToName ?? "");
  const [shipToAddress, setShipToAddress] = useState(initialValues?.shipToAddress ?? "");
  const [shipToGstin, setShipToGstin] = useState(initialValues?.shipToGstin ?? "");
  const [shipToStateCode, setShipToStateCode] = useState(initialValues?.shipToStateCode ?? "");

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
      itemQuery: item.name,
      description: item.name,
      detail: item.description ?? "",
      hsnCode: item.hsnCode,
      unit: item.unit,
      rate: item.salePrice.toString(),
      taxRate: item.taxRate.toString(),
    });
  }

  /** Fires on every keystroke in the searchable item picker. An exact (case-insensitive) name
   * match auto-fills the line like a normal pick; anything else is just free text -- the line
   * falls back to manual (itemId cleared). Either way `description` (the line's actual Name
   * of Product on the invoice) mirrors this field directly -- there's no separate visible
   * input for it, since showing the item name twice (once in the picker, once right next to
   * it) was pure duplication. */
  function onItemQueryChange(index: number, value: string) {
    const match = items.find((i) => i.name.toLowerCase() === value.trim().toLowerCase());
    if (match) {
      pickItem(index, match.id);
    } else {
      updateLine(index, { itemQuery: value, itemId: "", description: value });
    }
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
    setNewItem({ name: "", description: "", hsnCode: "", unit: "NOS", salePrice: "", taxRate: "18" });
    setNewItemError(null);
  }

  function cancelNewSite() {
    setShowNewSiteForm(false);
    setNewSiteName("");
    setNewSiteError(null);
  }

  async function addSite() {
    if (!newSiteName.trim()) {
      setNewSiteError("Name is required");
      return;
    }
    setSavingNewSite(true);
    setNewSiteError(null);
    try {
      const res = await fetch("/api/sites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newSiteName.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create site");
      const created: Site = { id: data.id, name: data.name };
      setSites((ss) => [...ss, created].sort((a, b) => a.name.localeCompare(b.name)));
      setSiteId(created.id);
      cancelNewSite();
      router.refresh();
    } catch (e) {
      setNewSiteError(e instanceof Error ? e.message : "Failed to create site");
    } finally {
      setSavingNewSite(false);
    }
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
        description: data.description ?? undefined,
        hsnCode: data.hsnCode,
        unit: data.unit,
        salePrice: Number(data.salePrice),
        taxRate: Number(data.taxRate),
      };
      setItems((its) => [...its, created].sort((a, b) => a.name.localeCompare(b.name)));
      setNewItem({ name: "", description: "", hsnCode: "", unit: "NOS", salePrice: "", taxRate: "18" });
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
      const body: Record<string, unknown> = {
        discount: Number(discount) || 0,
        poNumber: poNumber || undefined,
        poDate: poDate || undefined,
        vehicleNumber: vehicleNumber || undefined,
        transportationMode: transportationMode || undefined,
        reverseCharge,
        deliveredThrough: deliveredThrough || undefined,
        placeOfSupplySite: placeOfSupplySite || undefined,
        siteId: siteId || undefined,
        paymentTerms: paymentTerms || undefined,
        shipToSameAsBilling,
        shipToName: shipToSameAsBilling ? undefined : shipToName || undefined,
        shipToAddress: shipToSameAsBilling ? undefined : shipToAddress || undefined,
        shipToGstin: shipToSameAsBilling ? undefined : shipToGstin || undefined,
        shipToStateCode: shipToSameAsBilling ? undefined : shipToStateCode || undefined,
        lines: lines.map((l) => ({
          itemId: l.itemId || undefined,
          srNo: l.srNo,
          description: l.description,
          detail: l.detail || undefined,
          hsnCode: l.hsnCode,
          unit: l.unit,
          qty: Number(l.qty),
          rate: Number(l.rate),
          taxRate: Number(l.taxRate),
        })),
      };
      if (isEdit) {
        body.date = date || undefined;
      } else {
        body.customerId = customerId;
        body.type = type;
        body.isServiceInvoice = isServiceInvoice;
      }

      const res = await fetch(isEdit ? `/api/invoices/${editInvoiceId}` : "/api/invoices", {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Failed to ${isEdit ? "update" : "create"} invoice`);
      router.push(`/invoices/${isEdit ? editInvoiceId : data.id}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : `Failed to ${isEdit ? "update" : "create"} invoice`);
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
          {isEdit ? (
            <input readOnly value={customers.find((c) => c.id === customerId)?.name ?? ""} title="Customer can't be changed once an invoice is raised" />
          ) : (
            <select value={customerId} onChange={(e) => setCustomerId(e.target.value)} required>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} (state {c.stateCode})
                </option>
              ))}
            </select>
          )}
        </div>
        {isEdit && (
          <div className="afs-form-field">
            <label>Invoice Date</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
          </div>
        )}
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
          <label>E Way No</label>
          <input value={placeOfSupplySite} onChange={(e) => setPlaceOfSupplySite(e.target.value)} />
        </div>
        <div className="afs-form-field">
          <label style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            Site
            <button
              type="button"
              onClick={() => setShowNewSiteForm((v) => !v)}
              style={{ fontSize: 11.5, fontWeight: 400, color: "#2b5cb2", background: "none", border: "none", cursor: "pointer", padding: 0 }}
            >
              + New site
            </button>
          </label>
          <select value={siteId} onChange={(e) => setSiteId(e.target.value)}>
            <option value="">— none —</option>
            {sites.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          {showNewSiteForm && (
            <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
              <input
                autoFocus
                value={newSiteName}
                onChange={(e) => setNewSiteName(e.target.value)}
                placeholder="New site name"
                style={{ flex: 1 }}
              />
              <button type="button" onClick={addSite} disabled={savingNewSite} className="afs-btn afs-btn-primary" style={{ padding: "4px 10px", fontSize: 12 }}>
                {savingNewSite ? "Adding…" : "Add"}
              </button>
              <button type="button" onClick={cancelNewSite} disabled={savingNewSite} className="afs-btn" style={{ padding: "4px 10px", fontSize: 12, background: "#e5e7eb", color: "#333" }}>
                Cancel
              </button>
            </div>
          )}
          {newSiteError && <div style={{ color: "#b91c1c", fontSize: 11.5, marginTop: 4 }}>{newSiteError}</div>}
        </div>
        <div className="afs-form-field">
          <label>Payment Terms</label>
          <input
            list="payment-terms-options"
            value={paymentTerms}
            onChange={(e) => setPaymentTerms(e.target.value)}
            placeholder="e.g. Net 30"
          />
          <datalist id="payment-terms-options">
            {PAYMENT_TERMS_OPTIONS.map((t) => (
              <option key={t} value={t} />
            ))}
          </datalist>
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
            <th>Item</th>
            <th>Description</th>
            <th>HSN/SAC</th>
            <th style={{ width: 100 }}>Unit</th>
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
                  <input
                    required
                    type="text"
                    list="afs-items-datalist"
                    value={line.itemQuery}
                    onChange={(e) => onItemQueryChange(idx, e.target.value)}
                    placeholder="Search item, or type a name manually"
                    autoComplete="off"
                  />
                </td>
                <td data-label="Description">
                  <input
                    value={line.detail}
                    onChange={(e) => updateLine(idx, { detail: e.target.value })}
                    placeholder="Description / spec (optional)"
                  />
                </td>
                <td data-label="HSN/SAC">
                  <input required value={line.hsnCode} onChange={(e) => updateLine(idx, { hsnCode: e.target.value })} />
                </td>
                <td data-label="Unit">
                  <select required value={line.unit} onChange={(e) => updateLine(idx, { unit: e.target.value })}>
                    {COMMON_UNITS.map((u) => (
                      <option key={u} value={u}>
                        {u}
                      </option>
                    ))}
                  </select>
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

      <datalist id="afs-items-datalist">
        {items.map((i) => (
          <option key={i.id} value={i.name} />
        ))}
      </datalist>

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
              <label>Description</label>
              <input value={newItem.description} onChange={(e) => setNewItemField("description", e.target.value)} placeholder="Optional spec/detail" />
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
        {isEdit
          ? saving
            ? "Saving…"
            : "Save Changes"
          : saving
            ? "Creating…"
            : type === "PROFORMA"
              ? "Create Proforma Invoice"
              : type === "QUOTATION"
                ? "Create Quotation"
                : isServiceInvoice
                  ? "Create Service Tax Invoice"
                  : "Create Sale Invoice"}
      </button>
    </form>
  );
}
