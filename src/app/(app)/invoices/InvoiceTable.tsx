"use client";

import { useState } from "react";
import Link from "next/link";
import InvoiceRowActions from "./InvoiceRowActions";
import InvoiceJsonExport, { JsonExportRow } from "./InvoiceJsonExport";

export interface InvoiceRow {
  id: string;
  number: string;
  typeLabel: string;
  customerName: string;
  date: string;
  total: string;
  status: string;
  /** Only an issued sale invoice is an outward supply, so only those are selectable. */
  eligible: boolean;
  gstJsonName: string | null;
  convertedTo: { id: string; number: string }[];
}

function badgeClass(status: string) {
  return `afs-badge afs-badge-${status.toLowerCase()}`;
}

export default function InvoiceTable({ invoices }: { invoices: InvoiceRow[] }) {
  const [selected, setSelected] = useState<Set<string>>(new Set());

  function toggle(id: string, on: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  function toggleAll(ids: string[], on: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      for (const id of ids) {
        if (on) next.add(id);
        else next.delete(id);
      }
      return next;
    });
  }

  const exportRows: JsonExportRow[] = invoices.map((i) => ({
    id: i.id,
    number: i.number,
    eligible: i.eligible,
    gstJsonName: i.gstJsonName,
  }));

  return (
    <>
      <InvoiceJsonExport rows={exportRows} selected={selected} onToggleAll={toggleAll} />

      <table className="afs-table">
        <thead>
          <tr>
            <th style={{ width: 36 }}></th>
            <th>Number</th>
            <th>Type</th>
            <th>Customer</th>
            <th>Date</th>
            <th>Total</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {invoices.map((inv) => (
            <tr key={inv.id} className={selected.has(inv.id) ? "inv-row-selected" : undefined}>
              <td data-label="">
                <input
                  type="checkbox"
                  checked={selected.has(inv.id)}
                  disabled={!inv.eligible}
                  onChange={(e) => toggle(inv.id, e.target.checked)}
                  title={inv.eligible ? `Include ${inv.number} in a GST JSON` : "Only issued sale invoices can go in a GST JSON"}
                  aria-label={`Select ${inv.number}`}
                />
              </td>
              <td data-label="Number">
                <Link href={`/invoices/${inv.id}`}>{inv.number}</Link>
                {inv.gstJsonName && (
                  <div className="inv-json-tag" title={`Already in ${inv.gstJsonName}`}>
                    in JSON
                  </div>
                )}
              </td>
              <td data-label="Type">{inv.typeLabel}</td>
              <td data-label="Customer">{inv.customerName}</td>
              <td data-label="Date">{inv.date}</td>
              <td data-label="Total">Rs. {inv.total}</td>
              <td data-label="Status">
                <span className={badgeClass(inv.status)}>{inv.status.replace("_", " ")}</span>
              </td>
              <td>
                <InvoiceRowActions invoiceId={inv.id} />
                {inv.convertedTo.length > 0 && (
                  <div style={{ fontSize: 12, color: "#667", marginTop: 4 }}>
                    Converted →{" "}
                    {inv.convertedTo.map((s, i) => (
                      <span key={s.id}>
                        {i > 0 && ", "}
                        <Link href={`/invoices/${s.id}`}>{s.number}</Link>
                      </span>
                    ))}
                  </div>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
