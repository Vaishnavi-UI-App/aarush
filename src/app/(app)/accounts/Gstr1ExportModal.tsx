"use client";

import { useMemo, useState } from "react";

function isoDay(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Pulls down the GSTR-1 workbook for a period. The return is filed for the whole
 * business rather than one buyer, so the only thing to choose is the period -- every
 * customer billed in it is included, each on the sheet its supply type belongs to.
 * Defaults to the current calendar month, since GSTR-1 is filed month by month. */
export default function Gstr1ExportModal({ onClose }: { onClose: () => void }) {
  const today = useMemo(() => new Date(), []);
  const [fromDate, setFromDate] = useState(() => isoDay(new Date(today.getFullYear(), today.getMonth(), 1)));
  const [toDate, setToDate] = useState(() => isoDay(today));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dateOrderWrong = Boolean(fromDate && toDate && fromDate > toDate);

  async function generate() {
    if (dateOrderWrong) return setError("From date must be on or before the to date.");

    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/reports/customer-gstr1", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fromDate, toDate }),
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
        <p>Every customer&apos;s outward supplies for a period, as a GST offline tool workbook.</p>

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
          <button type="button" className="afs-btn afs-btn-gold" onClick={generate} disabled={busy || dateOrderWrong}>
            {busy ? "Generating..." : "Generate"}
          </button>
        </div>
      </div>
    </div>
  );
}
