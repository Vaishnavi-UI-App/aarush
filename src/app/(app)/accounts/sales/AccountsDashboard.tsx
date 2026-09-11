"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import MonthlySalesChart, { MonthPoint } from "./MonthlySalesChart";

export interface Sale {
  id: string;
  number: string;
  /** ISO string */
  date: string;
  customerId: string;
  customerName: string;
  status: string;
  total: number;
  received: number;
  outstanding: number;
}

interface CustomerOption {
  id: string;
  name: string;
}

type Preset = "thisMonth" | "lastMonth" | "thisFy" | "lastFy" | "all" | "custom";
type Tab = "months" | "customers" | "sales";

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

export default function AccountsDashboard({ sales, customers }: { sales: Sale[]; customers: CustomerOption[] }) {
  const today = useMemo(() => new Date(), []);
  const [preset, setPreset] = useState<Preset>("thisFy");
  const [custom, setCustom] = useState(() => rangeFor("thisFy", new Date()));
  const [customerId, setCustomerId] = useState("all");
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<Tab>("months");

  const range = preset === "custom" ? custom : rangeFor(preset, today);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return sales.filter((s) => {
      const day = s.date.slice(0, 10);
      if (range.from && day < range.from) return false;
      if (range.to && day > range.to) return false;
      if (customerId !== "all" && s.customerId !== customerId) return false;
      if (q && !s.number.toLowerCase().includes(q) && !s.customerName.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [sales, range.from, range.to, customerId, search]);

  const stats = useMemo(() => {
    const total = filtered.reduce((sum, s) => sum + s.total, 0);
    const received = filtered.reduce((sum, s) => sum + s.received, 0);
    const outstanding = filtered.reduce((sum, s) => sum + s.outstanding, 0);
    return { total, received, outstanding, count: filtered.length };
  }, [filtered]);

  // Always the live calendar month, whatever the filter is set to -- it's the figure
  // you want at a glance, and it shouldn't move when you go looking at last year.
  const thisMonthTotal = useMemo(() => {
    const prefix = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
    return sales
      .filter((s) => s.date.slice(0, 7) === prefix && (customerId === "all" || s.customerId === customerId))
      .reduce((sum, s) => sum + s.total, 0);
  }, [sales, today, customerId]);

  const byMonth = useMemo(() => {
    const map = new Map<string, { total: number; received: number; outstanding: number; count: number }>();
    for (const s of filtered) {
      const key = s.date.slice(0, 7);
      const row = map.get(key) ?? { total: 0, received: 0, outstanding: 0, count: 0 };
      row.total += s.total;
      row.received += s.received;
      row.outstanding += s.outstanding;
      row.count += 1;
      map.set(key, row);
    }
    return [...map.entries()].map(([key, v]) => ({ key, label: monthLabel(key), ...v })).sort((a, b) => a.key.localeCompare(b.key));
  }, [filtered]);

  const byCustomer = useMemo(() => {
    const map = new Map<string, { name: string; total: number; received: number; outstanding: number; count: number }>();
    for (const s of filtered) {
      const row = map.get(s.customerId) ?? { name: s.customerName, total: 0, received: 0, outstanding: 0, count: 0 };
      row.total += s.total;
      row.received += s.received;
      row.outstanding += s.outstanding;
      row.count += 1;
      map.set(s.customerId, row);
    }
    return [...map.entries()].map(([id, v]) => ({ id, ...v })).sort((a, b) => b.total - a.total);
  }, [filtered]);

  const chartData: MonthPoint[] = byMonth.map((m) => ({ key: m.key, label: m.label, total: m.total }));
  const periodLabel = preset === "custom" ? `${range.from || "start"} to ${range.to || "today"}` : PRESET_LABELS[preset];

  function exportCurrentTab() {
    if (tab === "months") {
      downloadCsv(
        `sales-by-month-${iso(today)}.csv`,
        ["Month", "Invoices", "Sales", "Received", "Outstanding"],
        byMonth.map((m) => [m.label, m.count, m.total.toFixed(2), m.received.toFixed(2), m.outstanding.toFixed(2)])
      );
    } else if (tab === "customers") {
      downloadCsv(
        `sales-by-customer-${iso(today)}.csv`,
        ["Customer", "Invoices", "Sales", "Received", "Outstanding"],
        byCustomer.map((c) => [c.name, c.count, c.total.toFixed(2), c.received.toFixed(2), c.outstanding.toFixed(2)])
      );
    } else {
      downloadCsv(
        `all-sales-${iso(today)}.csv`,
        ["Date", "Invoice", "Customer", "Status", "Amount", "Received", "Outstanding"],
        filtered.map((s) => [
          new Date(s.date).toLocaleDateString("en-IN"),
          s.number,
          s.customerName,
          s.status,
          s.total.toFixed(2),
          s.received.toFixed(2),
          s.outstanding.toFixed(2),
        ])
      );
    }
  }

  return (
    <div>
      <div className="ac-toolbar">
        <div>
          <h1 className="afs-page-title">Sales</h1>
          <p className="afs-page-subtitle">Sales by month and by customer, with what&apos;s been received against each</p>
        </div>
        <button type="button" className="afs-btn afs-btn-gold" onClick={exportCurrentTab}>
          ⬇ Export this view
        </button>
      </div>

      <div className="afs-card ac-filters">
        <div className="ac-presets">
          {(Object.keys(PRESET_LABELS) as Exclude<Preset, "custom">[]).map((p) => (
            <button
              key={p}
              type="button"
              className={`ac-chip ${preset === p ? "active" : ""}`}
              onClick={() => setPreset(p)}
            >
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
            <span>Customer</span>
            <select value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
              <option value="all">All customers</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label className="ac-field ac-field-grow">
            <span>Search</span>
            <input placeholder="Invoice number or customer..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </label>
        </div>
      </div>

      <div className="ac-stat-grid">
        <div className="ac-stat-card">
          <div className="ac-stat-label">Total Sales · {periodLabel}</div>
          <div className="ac-stat-value">{money(stats.total)}</div>
          <div className="ac-stat-sub">{stats.count} invoice{stats.count === 1 ? "" : "s"}</div>
        </div>
        <div className="ac-stat-card">
          <div className="ac-stat-label">This Month</div>
          <div className="ac-stat-value" style={{ color: "#2a5fd6" }}>{money(thisMonthTotal)}</div>
          <div className="ac-stat-sub">{today.toLocaleDateString("en-IN", { month: "long", year: "numeric" })}</div>
        </div>
        <div className="ac-stat-card">
          <div className="ac-stat-label">Received</div>
          <div className="ac-stat-value" style={{ color: "#0ca30c" }}>{money(stats.received)}</div>
          <div className="ac-stat-sub">against these invoices</div>
        </div>
        <div className="ac-stat-card">
          <div className="ac-stat-label">Outstanding</div>
          <div className="ac-stat-value" style={{ color: stats.outstanding > 0 ? "#d03b3b" : "#889" }}>
            {money(stats.outstanding)}
          </div>
          <div className="ac-stat-sub">still to collect</div>
        </div>
      </div>

      <div className="afs-card" style={{ marginBottom: 20 }}>
        <div className="ac-tabs">
          <button type="button" className={`ac-tab ${tab === "months" ? "active" : ""}`} onClick={() => setTab("months")}>
            Month-wise
          </button>
          <button type="button" className={`ac-tab ${tab === "customers" ? "active" : ""}`} onClick={() => setTab("customers")}>
            Customer-wise
          </button>
          <button type="button" className={`ac-tab ${tab === "sales" ? "active" : ""}`} onClick={() => setTab("sales")}>
            All Sales ({filtered.length})
          </button>
        </div>

        {filtered.length === 0 ? (
          <div className="afs-empty">No sales match these filters.</div>
        ) : tab === "months" ? (
          <table className="afs-table">
            <thead>
              <tr>
                <th>Month</th>
                <th>Invoices</th>
                <th>Sales</th>
                <th>Received</th>
                <th>Outstanding</th>
              </tr>
            </thead>
            <tbody>
              {byMonth.map((m) => (
                <tr key={m.key}>
                  <td data-label="Month">{m.label}</td>
                  <td data-label="Invoices">{m.count}</td>
                  <td data-label="Sales">Rs. {money2(m.total)}</td>
                  <td data-label="Received" style={{ color: "#0ca30c" }}>Rs. {money2(m.received)}</td>
                  <td data-label="Outstanding" style={{ color: m.outstanding > 0 ? "var(--afs-maroon)" : undefined }}>
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
                <td>Rs. {money2(stats.received)}</td>
                <td>Rs. {money2(stats.outstanding)}</td>
              </tr>
            </tfoot>
          </table>
        ) : tab === "customers" ? (
          <table className="afs-table">
            <thead>
              <tr>
                <th>Customer</th>
                <th>Invoices</th>
                <th>Sales</th>
                <th>Received</th>
                <th>Outstanding</th>
              </tr>
            </thead>
            <tbody>
              {byCustomer.map((c) => (
                <tr key={c.id}>
                  <td data-label="Customer">
                    <Link href={`/customers/${c.id}`}>{c.name}</Link>
                  </td>
                  <td data-label="Invoices">{c.count}</td>
                  <td data-label="Sales">Rs. {money2(c.total)}</td>
                  <td data-label="Received" style={{ color: "#0ca30c" }}>Rs. {money2(c.received)}</td>
                  <td data-label="Outstanding" style={{ color: c.outstanding > 0 ? "var(--afs-maroon)" : undefined }}>
                    {c.outstanding > 0 ? `Rs. ${money2(c.outstanding)}` : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td>Total</td>
                <td>{stats.count}</td>
                <td>Rs. {money2(stats.total)}</td>
                <td>Rs. {money2(stats.received)}</td>
                <td>Rs. {money2(stats.outstanding)}</td>
              </tr>
            </tfoot>
          </table>
        ) : (
          <table className="afs-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Invoice</th>
                <th>Customer</th>
                <th>Status</th>
                <th>Amount</th>
                <th>Received</th>
                <th>Outstanding</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((s) => (
                <tr key={s.id}>
                  <td data-label="Date">{new Date(s.date).toLocaleDateString("en-IN")}</td>
                  <td data-label="Invoice">
                    <Link href={`/invoices/${s.id}`}>{s.number}</Link>
                  </td>
                  <td data-label="Customer">{s.customerName}</td>
                  <td data-label="Status">{s.status.replace(/_/g, " ")}</td>
                  <td data-label="Amount">Rs. {money2(s.total)}</td>
                  <td data-label="Received" style={{ color: "#0ca30c" }}>Rs. {money2(s.received)}</td>
                  <td data-label="Outstanding" style={{ color: s.outstanding > 0 ? "var(--afs-maroon)" : undefined }}>
                    {s.outstanding > 0 ? `Rs. ${money2(s.outstanding)}` : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={4}>Total</td>
                <td>Rs. {money2(stats.total)}</td>
                <td>Rs. {money2(stats.received)}</td>
                <td>Rs. {money2(stats.outstanding)}</td>
              </tr>
            </tfoot>
          </table>
        )}
      </div>

      <div className="afs-card">
        <div className="ac-section-title">Sales by month</div>
        <MonthlySalesChart data={chartData} />
      </div>
    </div>
  );
}
