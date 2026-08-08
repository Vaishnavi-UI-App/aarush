"use client";

import { useEffect, useState } from "react";
import EditExpenseModal, { EditableExpense } from "./EditExpenseModal";

interface Option {
  id: string;
  name: string;
}

interface ExpenseRecord {
  id: string;
  date: string;
  amount: string;
  companyPaid: string;
  personalPaid: string;
  fundType: "COMPANY" | "PERSONAL" | "SPLIT";
  note: string | null;
  site: { id: string; name: string };
  category: { id: string; name: string } | null;
  orderedBy: { id: string; name: string } | null;
  addedBy: { id: string; name: string | null; email: string };
}

export default function AllExpensesView({
  sites,
  categories,
  orderedByPeople,
  canEdit,
}: {
  sites: Option[];
  categories: Option[];
  orderedByPeople: Option[];
  canEdit: boolean;
}) {
  const [siteId, setSiteId] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [expenses, setExpenses] = useState<ExpenseRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState<ExpenseRecord | null>(null);

  useEffect(() => {
    const params = new URLSearchParams();
    if (siteId) params.set("siteId", siteId);
    if (from) params.set("from", from);
    if (to) params.set("to", to);

    setLoading(true);
    fetch(`/api/expenses?${params.toString()}`)
      .then((res) => res.json())
      .then((data) => setExpenses(Array.isArray(data) ? data : []))
      .finally(() => setLoading(false));
  }, [siteId, from, to]);

  const total = expenses.reduce((sum, e) => sum + Number(e.amount), 0);

  const reportParams = new URLSearchParams();
  if (siteId) reportParams.set("siteId", siteId);
  if (from) reportParams.set("from", from);
  if (to) reportParams.set("to", to);
  const reportQuery = reportParams.toString();

  return (
    <div>
      <div className="afs-card" style={{ marginBottom: 20, padding: 16 }}>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
          <div className="afs-form-field" style={{ maxWidth: 220 }}>
            <label>Site</label>
            <select value={siteId} onChange={(e) => setSiteId(e.target.value)}>
              <option value="">All sites</option>
              {sites.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
          <div className="afs-form-field" style={{ maxWidth: 160 }}>
            <label>From</label>
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div className="afs-form-field" style={{ maxWidth: 160 }}>
            <label>To</label>
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
          <div style={{ fontSize: 13, color: "#374151", paddingBottom: 10 }}>
            {loading ? "Loading…" : `${expenses.length} expense${expenses.length === 1 ? "" : "s"} · Rs. ${total.toFixed(2)} total`}
          </div>
          <div style={{ display: "flex", gap: 8, marginLeft: "auto", paddingBottom: 2 }}>
            <a href={`/api/expenses/export?${reportQuery}`} className="afs-btn" style={{ background: "#e5e7eb", color: "#333" }}>
              ⬇ Excel (CSV)
            </a>
            <a href={`/api/expenses/pdf?${reportQuery}`} target="_blank" rel="noopener noreferrer" className="afs-btn afs-btn-primary">
              ⬇ PDF Report
            </a>
          </div>
        </div>
      </div>

      <div className="afs-card">
        {expenses.length === 0 ? (
          <div className="afs-empty">No expenses for this filter.</div>
        ) : (
          <table className="afs-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Site</th>
                <th>Category</th>
                <th>Amount</th>
                <th>Split</th>
                <th>Added by</th>
                {canEdit && <th></th>}
              </tr>
            </thead>
            <tbody>
              {expenses.map((e) => (
                <tr key={e.id}>
                  <td data-label="Date">{new Date(e.date).toLocaleDateString("en-IN")}</td>
                  <td data-label="Site">{e.site.name}</td>
                  <td data-label="Category">{e.category?.name || "Uncategorized"}</td>
                  <td data-label="Amount">Rs. {Number(e.amount).toFixed(2)}</td>
                  <td data-label="Split">
                    <span className={`afs-badge afs-badge-${e.fundType.toLowerCase()}`}>{e.fundType}</span>
                  </td>
                  <td data-label="Added by">{e.addedBy.name || e.addedBy.email}</td>
                  {canEdit && (
                    <td>
                      <button
                        type="button"
                        onClick={() => setEditing(e)}
                        className="afs-btn"
                        style={{ background: "#e5e7eb", color: "#333", padding: "4px 12px" }}
                      >
                        Edit
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {editing && (
        <EditExpenseModal
          expense={editing as EditableExpense}
          categories={categories}
          orderedByPeople={orderedByPeople}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}
