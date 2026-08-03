"use client";

import { useEffect, useState } from "react";

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

export default function AllExpensesView({ sites }: { sites: Option[] }) {
  const [siteId, setSiteId] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [expenses, setExpenses] = useState<ExpenseRecord[]>([]);
  const [loading, setLoading] = useState(false);

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
              </tr>
            </thead>
            <tbody>
              {expenses.map((e) => (
                <tr key={e.id}>
                  <td>{new Date(e.date).toLocaleDateString("en-IN")}</td>
                  <td>{e.site.name}</td>
                  <td>{e.category?.name || "Uncategorized"}</td>
                  <td>Rs. {Number(e.amount).toFixed(2)}</td>
                  <td>
                    <span className={`afs-badge afs-badge-${e.fundType.toLowerCase()}`}>{e.fundType}</span>
                  </td>
                  <td>{e.addedBy.name || e.addedBy.email}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
