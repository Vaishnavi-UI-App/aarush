"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { TrashIcon } from "@/components/icons";

interface Customer {
  id: string;
  name: string;
  address: string | null;
}

interface Site {
  id: string;
  name: string;
}

interface Line {
  particulars: string;
  qty: string;
}

function emptyLine(): Line {
  return { particulars: "", qty: "1" };
}

export default function NewDeliveryChallanForm({ customers, sites }: { customers: Customer[]; sites: Site[] }) {
  const router = useRouter();
  const [customerId, setCustomerId] = useState("");
  const [toName, setToName] = useState("");
  const [toAddress, setToAddress] = useState("");
  const [poNumber, setPoNumber] = useState("");
  const [poDate, setPoDate] = useState("");
  const [vehicleNumber, setVehicleNumber] = useState("");
  const [siteId, setSiteId] = useState("");
  const [lines, setLines] = useState<Line[]>([emptyLine()]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function pickCustomer(id: string) {
    setCustomerId(id);
    const customer = customers.find((c) => c.id === id);
    if (customer) {
      setToName(customer.name);
      setToAddress(customer.address ?? "");
    }
  }

  function updateLine(index: number, patch: Partial<Line>) {
    setLines((ls) => ls.map((l, i) => (i === index ? { ...l, ...patch } : l)));
  }

  function addLine() {
    setLines((ls) => [...ls, emptyLine()]);
  }

  function removeLine(index: number) {
    setLines((ls) => ls.filter((_, i) => i !== index));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/delivery-challans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId: customerId || undefined,
          siteId: siteId || undefined,
          toName: toName || undefined,
          toAddress: toAddress || undefined,
          poNumber: poNumber || undefined,
          poDate: poDate || undefined,
          vehicleNumber: vehicleNumber || undefined,
          lines: lines.map((l) => ({ particulars: l.particulars, qty: Number(l.qty) })),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create delivery challan");
      router.push(`/delivery-challans/${data.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create delivery challan");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={onSubmit}>
      <div className="afs-form-row">
        <div className="afs-form-field">
          <label>Customer</label>
          <select value={customerId} onChange={(e) => pickCustomer(e.target.value)}>
            <option value="">— manual —</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div className="afs-form-field">
          <label>Vehicle Number</label>
          <input value={vehicleNumber} onChange={(e) => setVehicleNumber(e.target.value)} />
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

      <div className="afs-form-row">
        <div className="afs-form-field">
          <label>To (Name)</label>
          <input value={toName} onChange={(e) => setToName(e.target.value)} />
        </div>
        <div className="afs-form-field">
          <label>To (Address)</label>
          <input value={toAddress} onChange={(e) => setToAddress(e.target.value)} />
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
      </div>

      <table className="afs-table" style={{ marginTop: 10, marginBottom: 10 }}>
        <thead>
          <tr>
            <th>Particulars</th>
            <th style={{ width: 120 }}>Qty</th>
            <th style={{ width: 40, position: "sticky", right: 0, background: "#f2f4fa" }}></th>
          </tr>
        </thead>
        <tbody>
          {lines.map((line, idx) => (
            <tr key={idx}>
              <td data-label="Particulars">
                <input required value={line.particulars} onChange={(e) => updateLine(idx, { particulars: e.target.value })} />
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
              <td style={{ position: "sticky", right: 0, background: "#fff", zIndex: 1 }}>
                <button type="button" onClick={() => removeLine(idx)} title="Delete line" className="afs-icon-btn danger">
                  <TrashIcon />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <button type="button" onClick={addLine} className="afs-btn afs-btn-gold" style={{ marginBottom: 20 }}>
        + Add line
      </button>

      {error && <div style={{ color: "#b91c1c", fontSize: 13, marginBottom: 12 }}>{error}</div>}

      <div>
        <button type="submit" disabled={saving} className="afs-btn afs-btn-primary">
          {saving ? "Creating…" : "Create Delivery Challan"}
        </button>
      </div>
    </form>
  );
}
