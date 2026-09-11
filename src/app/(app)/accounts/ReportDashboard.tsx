"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import MonthlyBarChart, { MonthPoint } from "./MonthlyBarChart";

/** One billed document -- a sale invoice or a purchase bill. The two reports differ
 * only in wording and where their links point, so they share this shape. */
export interface ReportRow {
  id: string;
  /** Our own document number, e.g. "INV/26-27/1" or "PB/26-27/4". */
  number: string;
  /** ISO string */
  date: string;
  partyId: string;
  partyName: string;
  status: string;
  total: number;
  /** Money settled against it: received from a customer, or paid to a vendor. */
  settled: number;
  outstanding: number;
}

export interface ReportConfig {
  title: string;
  subtitle: string;
  /** Column header and filter label for the other party. */
  partyLabel: string;
  partyHrefBase: string;
  partyFilterAllLabel: string;
  docLabel: string;
  docHrefBase: string;
  /** What the money column is called, e.g. "Sales" / "Purchases". */
  amountLabel: string;
  settledLabel: string;
  outstandingLabel: string;
  outstandingHint: string;
  /** Used in downloaded file names and the empty state. */
  fileStem: string;
  emptyLabel: string;
  countNoun: string;
}

type Preset = "thisMonth" | "lastMonth" | "thisFy" | "lastFy" | "all" | "custom";
type Tab = "months" | "parties" | "docs";

function money(n: number): string {
  return `₹${n.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
}

function money2(n: number): string {
  return n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function iso(d: Date): string {
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

/** Indian financial year: 1 April to 31 March. */
function fyStartYear(d: Date): number {
  return d.getMonth() >= 3 ? d.getFullYear() : d.getFullYear() - 1;
}

function rangeFor(preset: Preset, today: Date): { from: string; to: string } {
  const y = today.getFullYear();
  const m = today.getMonth();
  switch (preset) {
    case "thisMonth":
      return { from: iso(new Date(y, m, 1)), to: iso(new Date(y, m + 1, 0)) };
    case "lastMonth":
      return { from: iso(new Date(y, m - 1, 1)), to: iso(new Date(y, m, 0)) };
    case "thisFy": {
      const s = fyStartYear(today);
      return { from: iso(new Date(s, 3, 1)), to: iso(new Date(s + 1, 2, 31)) };
    }
    case "lastFy": {
      const s = fyStartYear(today) - 1;
      return { from: iso(new Date(s, 3, 1)), to: iso(new Date(s + 1, 2, 31)) };
    }
    default:
      return { from: "", to: "" };
  }
}

const PRESET_LABELS: Record<Exclude<Preset, "custom">, string> = {
  thisMonth: "This Month",
  lastMonth: "Last Month",
  thisFy: "This FY",
  lastFy: "Last FY",
  all: "All Time",
};

function monthLabel(key: string): string {
  const [y, m] = key.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("en-IN", { month: "short", year: "numeric" });
}

function downloadCsv(filename: string, header: string[], rows: (string | number)[][]) {
  const cell = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
  const csv = "﻿" + [header, ...rows].map((r) => r.map(cell).join(",")).join("\r\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function ReportDashboard({
  rows,
  parties,
  config,
}: {
  rows: ReportRow[];
  parties: { id: string; name: string }[];
  config: ReportConfig;
}) {
  const today = useMemo(() => new Date(), []);
  const [preset, setPreset] = useState<Preset>("thisFy");
  const [custom, setCustom] = useState(() => rangeFor("thisFy", new Date()));
  const [partyId, setPartyId] = useState("all");
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<Tab>("months");

  const range = preset === "custom" ? custom : rangeFor(preset, today);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      const day = r.date.slice(0, 10);
      if (range.from && day < range.from) return false;
      if (range.to && day > range.to) return false;
      if (partyId !== "all" && r.partyId !== partyId) return false;
      if (q && !r.number.toLowerCase().includes(q) && !r.partyName.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [rows, range.from, range.to, partyId, search]);

  const stats = useMemo(() => {
    const total = filtered.reduce((sum, r) => sum + r.total, 0);
    const settled = filtered.reduce((sum, r) => sum + r.settled, 0);
    const outstanding = filtered.reduce((sum, r) => sum + r.outstanding, 0);
    return { total, settled, outstanding, count: filtered.length };
  }, [filtered]);

  // Always the live calendar month, whatever the filter is set to -- it's the figure
  // you want at a glance, and it shouldn't move when you go looking at last year.
  const thisMonthTotal = useMemo(() => {
    const prefix = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
    return rows
      .filter((r) => r.date.slice(0, 7) === prefix && (partyId === "all" || r.partyId === partyId))
      .reduce((sum, r) => sum + r.total, 0);
  }, [rows, today, partyId]);

  const byMonth = useMemo(() => {
    const map = new Map<string, { total: number; settled: number; outstanding: number; count: number }>();
    for (const r of filtered) {
      const key = r.date.slice(0, 7);
      const row = map.get(key) ?? { total: 0, settled: 0, outstanding: 0, count: 0 };
      row.total += r.total;
      row.settled += r.settled;
      row.outstanding += r.outstanding;
      row.count += 1;
      map.set(key, row);
    }
    return [...map.entries()].map(([key, v]) => ({ key, label: monthLabel(key), ...v })).sort((a, b) => a.key.localeCompare(b.key));
  }, [filtered]);

  const byParty = useMemo(() => {
    const map = new Map<string, { name: string; total: number; settled: number; outstanding: number; count: number }>();
    for (const r of filtered) {
      const row = map.get(r.partyId) ?? { name: r.partyName, total: 0, settled: 0, outstanding: 0, count: 0 };
      row.total += r.total;
      row.settled += r.settled;
      row.outstanding += r.outstanding;
      row.count += 1;
      map.set(r.partyId, row);
    }
    return [...map.entries()].map(([id, v]) => ({ id, ...v })).sort((a, b) => b.total - a.total);
  }, [filtered]);

  const chartData: MonthPoint[] = byMonth.map((m) => ({ key: m.key, label: m.label, total: m.total }));
  const periodLabel = preset === "custom" ? `${range.from || "start"} to ${range.to || "today"}` : PRESET_LABELS[preset];

  function exportCurrentTab() {
    if (tab === "months") {
      downloadCsv(
        `${config.fileStem}-by-month-${iso(today)}.csv`,
        ["Month", config.countNoun, config.amountLabel, config.settledLabel, config.outstandingLabel],
        byMonth.map((m) => [m.label, m.count, m.total.toFixed(2), m.settled.toFixed(2), m.outstanding.toFixed(2)])
      );
    } else if (tab === "parties") {
      downloadCsv(
        `${config.fileStem}-by-${config.partyLabel.toLowerCase()}-${iso(today)}.csv`,
        [config.partyLabel, config.countNoun, config.amountLabel, config.settledLabel, config.outstandingLabel],
        byParty.map((p) => [p.name, p.count, p.total.toFixed(2), p.settled.toFixed(2), p.outstanding.toFixed(2)])
      );
    } else {
      downloadCsv(
        `all-${config.fileStem}-${iso(today)}.csv`,
        ["Date", config.docLabel, config.partyLabel, "Status", "Amount", config.settledLabel, config.outstandingLabel],
        filtered.map((r) => [
          new Date(r.date).toLocaleDateString("en-IN"),
          r.number,
          r.partyName,
          r.status,
          r.total.toFixed(2),
          r.settled.toFixed(2),
          r.outstanding.toFixed(2),
        ])
      );
    }
  }

  return (
    <div>
      <div className="ac-toolbar">
        <div>
          <h1 className="afs-page-title">{config.title}</h1>
          <p className="afs-page-subtitle">{config.subtitle}</p>
        </div>
        <button type="button" className="afs-btn afs-btn-gold" onClick={exportCurrentTab}>
          ⬇ Export this view
        </button>
      </div>

      <div className="afs-card ac-filters">
        <div className="ac-presets">
          {(Object.keys(PRESET_LABELS) as Exclude<Preset, "custom">[]).map((p) => (
            <button key={p} type="button" className={`ac-chip ${preset === p ? "active" : ""}`} onClick={() => setPreset(p)}>
              {PRESET_LABELS[p]}
            </button>
          ))}
        </div>
        <div className="ac-filter-row">
          <label className="ac-field">
            <span>From</span>
            <input
              type="date"
              value={range.from}
              onChange={(e) => {
                setCustom({ from: e.target.value, to: range.to });
                setPreset("custom");
              }}
            />
          </label>
          <label className="ac-field">
            <span>To</span>
            <input
              type="date"
              value={range.to}
              onChange={(e) => {
                setCustom({ from: range.from, to: e.target.value });
                setPreset("custom");
              }}
            />
          </label>
          <label className="ac-field">
            <span>{config.partyLabel}</span>
            <select value={partyId} onChange={(e) => setPartyId(e.target.value)}>
              <option value="all">{config.partyFilterAllLabel}</option>
              {parties.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
          <label className="ac-field ac-field-grow">
            <span>Search</span>
            <input
              placeholder={`${config.docLabel} number or ${config.partyLabel.toLowerCase()}...`}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>
        </div>
      </div>

      <div className="ac-stat-grid">
        <div className="ac-stat-card">
          <div className="ac-stat-label">
            Total {config.amountLabel} · {periodLabel}
          </div>
          <div className="ac-stat-value">{money(stats.total)}</div>
          <div className="ac-stat-sub">
            {stats.count} {config.countNoun.toLowerCase()}
          </div>
        </div>
        <div className="ac-stat-card">
          <div className="ac-stat-label">This Month</div>
          <div className="ac-stat-value" style={{ color: "#2a5fd6" }}>
            {money(thisMonthTotal)}
          </div>
          <div className="ac-stat-sub">{today.toLocaleDateString("en-IN", { month: "long", year: "numeric" })}</div>
        </div>
        <div className="ac-stat-card">
          <div className="ac-stat-label">{config.settledLabel}</div>
          <div className="ac-stat-value" style={{ color: "#0ca30c" }}>
            {money(stats.settled)}
          </div>
          <div className="ac-stat-sub">against these {config.countNoun.toLowerCase()}</div>
        </div>
        <div className="ac-stat-card">
          <div className="ac-stat-label">{config.outstandingLabel}</div>
          <div className="ac-stat-value" style={{ color: stats.outstanding > 0 ? "#d03b3b" : "#889" }}>
            {money(stats.outstanding)}
          </div>
          <div className="ac-stat-sub">{config.outstandingHint}</div>
        </div>
      </div>

      <div className="afs-card" style={{ marginBottom: 20 }}>
        <div className="ac-tabs">
          <button type="button" className={`ac-tab ${tab === "months" ? "active" : ""}`} onClick={() => setTab("months")}>
            Month-wise
          </button>
          <button type="button" className={`ac-tab ${tab === "parties" ? "active" : ""}`} onClick={() => setTab("parties")}>
            {config.partyLabel}-wise
          </button>
          <button type="button" className={`ac-tab ${tab === "docs" ? "active" : ""}`} onClick={() => setTab("docs")}>
            All {config.amountLabel} ({filtered.length})
          </button>
        </div>

        {filtered.length === 0 ? (
          <div className="afs-empty">No {config.amountLabel.toLowerCase()} match these filters.</div>
        ) : tab === "months" ? (
          <table className="afs-table">
            <thead>
              <tr>
                <th>Month</th>
                <th>{config.countNoun}</th>
                <th>{config.amountLabel}</th>
                <th>{config.settledLabel}</th>
                <th>{config.outstandingLabel}</th>
              </tr>
            </thead>
            <tbody>
              {byMonth.map((m) => (
                <tr key={m.key}>
                  <td data-label="Month">{m.label}</td>
                  <td data-label={config.countNoun}>{m.count}</td>
                  <td data-label={config.amountLabel}>Rs. {money2(m.total)}</td>
                  <td data-label={config.settledLabel} style={{ color: "#0ca30c" }}>
                    Rs. {money2(m.settled)}
                  </td>
                  <td data-label={config.outstandingLabel} style={{ color: m.outstanding > 0 ? "var(--afs-maroon)" : undefined }}>
                    {m.outstanding > 0 ? `Rs. ${money2(m.outstanding)}` : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td>Total</td>
                <td>{stats.count}</td>
                <td>Rs. {money2(stats.total)}</td>
                <td>Rs. {money2(stats.settled)}</td>
                <td>Rs. {money2(stats.outstanding)}</td>
              </tr>
            </tfoot>
          </table>
        ) : tab === "parties" ? (
          <table className="afs-table">
            <thead>
              <tr>
                <th>{config.partyLabel}</th>
                <th>{config.countNoun}</th>
                <th>{config.amountLabel}</th>
                <th>{config.settledLabel}</th>
                <th>{config.outstandingLabel}</th>
              </tr>
            </thead>
            <tbody>
              {byParty.map((p) => (
                <tr key={p.id}>
                  <td data-label={config.partyLabel}>
                    <Link href={`${config.partyHrefBase}/${p.id}`}>{p.name}</Link>
                  </td>
                  <td data-label={config.countNoun}>{p.count}</td>
                  <td data-label={config.amountLabel}>Rs. {money2(p.total)}</td>
                  <td data-label={config.settledLabel} style={{ color: "#0ca30c" }}>
                    Rs. {money2(p.settled)}
                  </td>
                  <td data-label={config.outstandingLabel} style={{ color: p.outstanding > 0 ? "var(--afs-maroon)" : undefined }}>
                    {p.outstanding > 0 ? `Rs. ${money2(p.outstanding)}` : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td>Total</td>
                <td>{stats.count}</td>
                <td>Rs. {money2(stats.total)}</td>
                <td>Rs. {money2(stats.settled)}</td>
                <td>Rs. {money2(stats.outstanding)}</td>
              </tr>
            </tfoot>
          </table>
        ) : (
          <table className="afs-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>{config.docLabel}</th>
                <th>{config.partyLabel}</th>
                <th>Status</th>
                <th>Amount</th>
                <th>{config.settledLabel}</th>
                <th>{config.outstandingLabel}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.id}>
                  <td data-label="Date">{new Date(r.date).toLocaleDateString("en-IN")}</td>
                  <td data-label={config.docLabel}>
                    <Link href={`${config.docHrefBase}/${r.id}`}>{r.number}</Link>
                  </td>
                  <td data-label={config.partyLabel}>{r.partyName}</td>
                  <td data-label="Status">{r.status.replace(/_/g, " ")}</td>
                  <td data-label="Amount">Rs. {money2(r.total)}</td>
                  <td data-label={config.settledLabel} style={{ color: "#0ca30c" }}>
                    Rs. {money2(r.settled)}
                  </td>
                  <td data-label={config.outstandingLabel} style={{ color: r.outstanding > 0 ? "var(--afs-maroon)" : undefined }}>
                    {r.outstanding > 0 ? `Rs. ${money2(r.outstanding)}` : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={4}>Total</td>
                <td>Rs. {money2(stats.total)}</td>
                <td>Rs. {money2(stats.settled)}</td>
                <td>Rs. {money2(stats.outstanding)}</td>
              </tr>
            </tfoot>
          </table>
        )}
      </div>

      <div className="afs-card">
        <div className="ac-section-title">{config.amountLabel} by month</div>
        <MonthlyBarChart data={chartData} emptyLabel={config.emptyLabel} ariaLabel={`${config.amountLabel} by month`} />
      </div>
    </div>
  );
}
