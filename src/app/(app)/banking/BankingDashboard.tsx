"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import RecordPaymentModal from "./RecordPaymentModal";
import { WhatsAppIcon, MailIcon, HistoryIcon } from "@/components/icons";

interface UnpaidInvoice {
  id: string;
  number: string;
  due: number;
}

interface CustomerRow {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  billed: number;
  paid: number;
  due: number;
  advance: number;
  unpaidInvoices: UnpaidInvoice[];
}

interface Totals {
  billed: number;
  paid: number;
  due: number;
  advance: number;
}

function money(n: number): string {
  return `₹${n.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
}

function downloadCsv(rows: CustomerRow[]) {
  const header = "Customer,Billed,Paid,Due,Advance\n";
  const body = rows
    .map((r) => `"${r.name.replace(/"/g, '""')}",${r.billed},${r.paid},${r.due},${r.advance}`)
    .join("\n");
  const blob = new Blob([header + body], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `customer-ledger-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function BankingDashboard({ rows, totals }: { rows: CustomerRow[]; totals: Totals }) {
  const [search, setSearch] = useState("");
  const [customerFilter, setCustomerFilter] = useState("all");
  const [modalOpen, setModalOpen] = useState(false);

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (customerFilter !== "all" && r.id !== customerFilter) return false;
      if (search && !r.name.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [rows, search, customerFilter]);

  return (
    <div>
      <div className="bk-toolbar">
        <div>
          <h1 className="afs-page-title">Banking</h1>
          <p className="afs-page-subtitle">Customer-wise paid, due &amp; advance amounts</p>
        </div>
        <div className="bk-toolbar-actions">
          <select className="bk-select" value={customerFilter} onChange={(e) => setCustomerFilter(e.target.value)}>
            <option value="all">All Customers</option>
            {rows.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
          <button type="button" className="afs-btn afs-btn-gold" onClick={() => downloadCsv(filtered)}>
            ⬇ Download Report
          </button>
          <button type="button" className="afs-btn afs-btn-primary" onClick={() => setModalOpen(true)}>
            + Record Payment
          </button>
          <Link href="/banking/accounts" style={{ fontSize: 13 }}>
            Bank Accounts →
          </Link>
        </div>
      </div>

      <div className="bk-stat-grid">
        <div className="bk-stat-card">
          <div className="bk-stat-icon bk-stat-icon-billed">🏦</div>
          <div>
            <div className="bk-stat-label">Total Billed</div>
            <div className="bk-stat-value">{money(totals.billed)}</div>
          </div>
        </div>
        <div className="bk-stat-card">
          <div className="bk-stat-icon bk-stat-icon-paid">📈</div>
          <div>
            <div className="bk-stat-label">Total Paid</div>
            <div className="bk-stat-value" style={{ color: "#0ca30c" }}>
              {money(totals.paid)}
            </div>
          </div>
        </div>
        <div className="bk-stat-card">
          <div className="bk-stat-icon bk-stat-icon-due">📉</div>
          <div>
            <div className="bk-stat-label">Total Due</div>
            <div className="bk-stat-value" style={{ color: "#d03b3b" }}>
              {money(totals.due)}
            </div>
          </div>
        </div>
        <div className="bk-stat-card">
          <div className="bk-stat-icon bk-stat-icon-advance">💳</div>
          <div>
            <div className="bk-stat-label">Total Advance</div>
            <div className="bk-stat-value">{money(totals.advance)}</div>
          </div>
        </div>
      </div>

      <div className="afs-card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <div style={{ fontWeight: 700 }}>Customer Ledger</div>
          <input
            className="bk-search"
            placeholder="Search customer..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {filtered.length === 0 ? (
          <div className="afs-empty">No customers found.</div>
        ) : (
          <table className="afs-table">
            <thead>
              <tr>
                <th>Customer</th>
                <th>Billed</th>
                <th>Paid</th>
                <th>Due</th>
                <th>Advance</th>
                <th>Share</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => {
                const whatsappHref = r.phone
                  ? `https://wa.me/91${r.phone.replace(/\D/g, "")}?text=${encodeURIComponent(
                      `Hi ${r.name}, this is a reminder that Rs. ${r.due.toFixed(2)} is due on your account. Please arrange payment at your earliest convenience. Thank you.`
                    )}`
                  : null;
                const mailHref = r.email
                  ? `mailto:${r.email}?subject=${encodeURIComponent("Payment Reminder")}&body=${encodeURIComponent(
                      `Hi ${r.name},\n\nThis is a reminder that Rs. ${r.due.toFixed(2)} is due on your account. Please arrange payment at your earliest convenience.\n\nThank you.`
                    )}`
                  : null;

                return (
                  <tr key={r.id}>
                    <td>{r.name}</td>
                    <td>{money(r.billed)}</td>
                    <td style={{ color: "#0ca30c" }}>{money(r.paid)}</td>
                    <td style={{ color: r.due > 0 ? "#d03b3b" : "#889" }}>{r.due > 0 ? money(r.due) : "—"}</td>
                    <td>{r.advance > 0 ? money(r.advance) : "—"}</td>
                    <td>
                      <div className="bk-share-icons">
                        <a
                          className={`bk-icon-btn whatsapp ${whatsappHref ? "" : "disabled"}`}
                          href={whatsappHref ?? undefined}
                          target="_blank"
                          rel="noopener noreferrer"
                          title={whatsappHref ? "Send reminder via WhatsApp" : "No phone number on file"}
                        >
                          <WhatsAppIcon />
                        </a>
                        <a
                          className={`bk-icon-btn mail ${mailHref ? "" : "disabled"}`}
                          href={mailHref ?? undefined}
                          title={mailHref ? "Send reminder via email" : "No email on file"}
                        >
                          <MailIcon />
                        </a>
                        <Link href={`/customers/${r.id}`} className="bk-icon-btn history" title="View full ledger history">
                          <HistoryIcon />
                        </Link>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {modalOpen && <RecordPaymentModal customers={rows} onClose={() => setModalOpen(false)} />}
    </div>
  );
}
