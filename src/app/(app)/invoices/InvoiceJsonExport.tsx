"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

export interface JsonExportRow {
  id: string;
  number: string;
  /** Only issued sale invoices can go in a return -- the rest aren't selectable. */
  eligible: boolean;
  gstJsonName: string | null;
}

interface AlreadyExported {
  number: string;
  jsonName: string;
  at: string | null;
}

/** Selection + "Create GST JSON" for the invoice list. The checkboxes live here rather
 * than in the server-rendered table, so the page itself stays a server component. */
export default function InvoiceJsonExport({
  rows,
  selected,
  onToggleAll,
}: {
  rows: JsonExportRow[];
  selected: Set<string>;
  onToggleAll: (ids: string[], on: boolean) => void;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [already, setAlready] = useState<AlreadyExported[] | null>(null);
  const [done, setDone] = useState<{ name: string; count: number; kb: string } | null>(null);

  const eligibleIds = useMemo(() => rows.filter((r) => r.eligible).map((r) => r.id), [rows]);
  const chosen = useMemo(() => [...selected].filter((id) => eligibleIds.includes(id)), [selected, eligibleIds]);
  const allOn = eligibleIds.length > 0 && eligibleIds.every((id) => selected.has(id));

  async function create(confirmed: boolean) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/reports/gst-json", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invoiceIds: chosen, confirmed }),
      });

      if (res.status === 409) {
        const data = await res.json();
        setAlready(data.alreadyExported);
        return;
      }
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || "Could not create the JSON file.");
      }

      const name = res.headers.get("X-Gst-Json-Name") ?? "gstr1.json";
      const bytes = Number(res.headers.get("X-Gst-Json-Bytes") ?? 0);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = name;
      a.click();
      URL.revokeObjectURL(url);

      setAlready(null);
      setDone({ name, count: chosen.length, kb: (bytes / 1024).toFixed(0) });
      onToggleAll(eligibleIds, false);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create the JSON file.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="inv-json-bar">
        <label className="inv-json-all">
          <input
            type="checkbox"
            checked={allOn}
            onChange={(e) => onToggleAll(eligibleIds, e.target.checked)}
            disabled={eligibleIds.length === 0}
          />
          Select all sale invoices
        </label>
        <span className="inv-json-count">
          {chosen.length === 0 ? "No bills selected" : `${chosen.length} bill${chosen.length === 1 ? "" : "s"} selected`}
        </span>
        <button
          type="button"
          className="afs-btn afs-btn-gold"
          onClick={() => create(false)}
          disabled={busy || chosen.length === 0}
        >
          {busy ? "Creating..." : "Create GST JSON"}
        </button>
      </div>

      {error && <div className="inv-json-error">{error}</div>}

      {already && (
        <div className="afs-modal-backdrop" onClick={() => setAlready(null)}>
          <div className="afs-modal" onClick={(e) => e.stopPropagation()}>
            <h2>Already in a JSON file</h2>
            <p>
              {already.length === 1 ? "This bill has" : "These bills have"} already been put in a GST JSON.
              Creating another will produce a second file containing {already.length === 1 ? "it" : "them"} again.
            </p>
            <ul className="inv-json-list">
              {already.map((a) => (
                <li key={a.number}>
                  <b>{a.number}</b>
                  <span className="inv-json-file">{a.jsonName}</span>
                  {a.at && <span className="inv-json-when">{new Date(a.at).toLocaleString("en-IN")}</span>}
                </li>
              ))}
            </ul>
            <div className="gstr1-actions">
              <button type="button" className="afs-btn" onClick={() => setAlready(null)} disabled={busy}>
                Cancel
              </button>
              <button type="button" className="afs-btn afs-btn-gold" onClick={() => create(true)} disabled={busy}>
                {busy ? "Creating..." : "Create anyway"}
              </button>
            </div>
          </div>
        </div>
      )}

      {done && (
        <div className="afs-modal-backdrop" onClick={() => setDone(null)}>
          <div className="afs-modal" onClick={(e) => e.stopPropagation()}>
            <h2>JSON file created</h2>
            <p>
              {done.count} bill{done.count === 1 ? "" : "s"} written to a GST return file, {done.kb} KB. It has
              downloaded to your computer.
            </p>
            <div className="inv-json-name">{done.name}</div>
            <div className="gstr1-actions">
              <button type="button" className="afs-btn afs-btn-gold" onClick={() => setDone(null)}>
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
