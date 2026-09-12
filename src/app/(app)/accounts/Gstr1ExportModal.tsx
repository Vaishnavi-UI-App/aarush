"use client";

import { useEffect, useMemo, useRef, useState } from "react";

function isoDay(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Picks a customer and a period and pulls down that customer's GSTR-1 workbook.
 * Defaults to the current calendar month, since GSTR-1 is filed month by month. */
export default function Gstr1ExportModal({
  customers,
  onClose,
}: {
  customers: { id: string; name: string }[];
  onClose: () => void;
}) {
  const today = useMemo(() => new Date(), []);
  const [customerId, setCustomerId] = useState("");
  const [query, setQuery] = useState("");
  const [listOpen, setListOpen] = useState(false);
  const [fromDate, setFromDate] = useState(() => isoDay(new Date(today.getFullYear(), today.getMonth(), 1)));
  const [toDate, setToDate] = useState(() => isoDay(today));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);

  const selected = customers.find((c) => c.id === customerId) ?? null;

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    const pool = q ? customers.filter((c) => c.name.toLowerCase().includes(q)) : customers;
    return pool.slice(0, 50);
  }, [customers, query]);

  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setListOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  const dateOrderWrong = Boolean(fromDate && toDate && fromDate > toDate);

  async function generate() {
    if (!customerId) return setError("Pick a customer first.");
    if (dateOrderWrong) return setError("From date must be on or before the to date.");

    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/reports/customer-gstr1", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customerId, fromDate, toDate }),
      });

      if (!res.ok) {
        // The route answers with JSON on every failure, including "nothing to report".
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || "Could not generate the statement.");
      }

      const blob = await res.blob();
      const disposition = res.headers.get("Content-Disposition") ?? "";
      const named = /filename="([^"]+)"/.exec(disposition);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = named ? named[1] : "gstr1.xlsx";
      a.click();
      URL.revokeObjectURL(url);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not generate the statement.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="afs-modal-backdrop" onClick={onClose}>
      <div className="afs-modal gstr1-modal" onClick={(e) => e.stopPropagation()}>
        <h2>Export GSTR-1</h2>
        <p>One customer&apos;s outward supplies for a period, as a GST offline tool workbook.</p>

        <div className="ac-field gstr1-field" ref={boxRef}>
          <label htmlFor="gstr1-customer">Customer</label>
          <input
            id="gstr1-customer"
            type="text"
            autoComplete="off"
            placeholder="Search customers..."
            value={listOpen ? query : selected?.name ?? ""}
            onFocus={() => {
              setListOpen(true);
              setQuery("");
            }}
            onChange={(e) => {
              setQuery(e.target.value);
              setListOpen(true);
            }}
          />
          {listOpen && (
            <ul className="gstr1-options">
              {matches.length === 0 && <li className="gstr1-empty">No customers match.</li>}
              {matches.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    className={c.id === customerId ? "active" : ""}
                    onClick={() => {
                      setCustomerId(c.id);
                      setListOpen(false);
                      setError(null);
                    }}
                  >
                    {c.name}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="gstr1-dates">
          <div className="ac-field">
            <label htmlFor="gstr1-from">From</label>
            <input id="gstr1-from" type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
          </div>
          <div className="ac-field">
            <label htmlFor="gstr1-to">To</label>
            <input id="gstr1-to" type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
          </div>
        </div>

        {dateOrderWrong && <p className="gstr1-error">From date must be on or before the to date.</p>}
        {error && <p className="gstr1-error">{error}</p>}

        <div className="gstr1-actions">
          <button type="button" className="afs-btn" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button
            type="button"
            className="afs-btn afs-btn-gold"
            onClick={generate}
            disabled={busy || !customerId || dateOrderWrong}
          >
            {busy ? "Generating..." : "Generate"}
          </button>
        </div>
      </div>
    </div>
  );
}
