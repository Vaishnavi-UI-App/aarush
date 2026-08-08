"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { EditIcon, TrashIcon } from "@/components/icons";
import EditFundModal from "./EditFundModal";
import EditExpenseModal, { EditableExpense } from "@/app/(app)/expenses/EditExpenseModal";

interface Option {
  id: string;
  name: string;
}

export type HistoryEntry =
  | { kind: "fund"; id: string; at: string; amount: string; note: string | null; reimbursedToPersonal: number; addedByName: string }
  | {
      kind: "expense";
      id: string;
      at: string;
      date: string;
      amount: string;
      note: string | null;
      fundType: string;
      category: { id: string; name: string } | null;
      orderedBy: { id: string; name: string } | null;
      addedByName: string;
    };

export default function SiteHistoryTable({
  siteId,
  entries,
  canEditFund,
  canDeleteFund,
  canEditExpense,
  canDeleteExpense,
  categories,
  orderedByPeople,
}: {
  siteId: string;
  entries: HistoryEntry[];
  canEditFund: boolean;
  canDeleteFund: boolean;
  canEditExpense: boolean;
  canDeleteExpense: boolean;
  categories: Option[];
  orderedByPeople: Option[];
}) {
  const router = useRouter();
  const [editingFund, setEditingFund] = useState<Extract<HistoryEntry, { kind: "fund" }> | null>(null);
  const [editingExpense, setEditingExpense] = useState<Extract<HistoryEntry, { kind: "expense" }> | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function deleteFund(entry: Extract<HistoryEntry, { kind: "fund" }>) {
    if (!window.confirm("Delete this fund entry? This reverses its effect on the site balance.")) return;
    setBusyId(entry.id);
    setError(null);
    try {
      const res = await fetch(`/api/sites/${siteId}/fund/${entry.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to delete fund");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete fund");
    } finally {
      setBusyId(null);
    }
  }

  async function deleteExpense(entry: Extract<HistoryEntry, { kind: "expense" }>) {
    if (!window.confirm("Delete this expense? This reverses its effect on the site balance.")) return;
    setBusyId(entry.id);
    setError(null);
    try {
      const res = await fetch(`/api/expenses/${entry.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to delete expense");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete expense");
    } finally {
      setBusyId(null);
    }
  }

  const showActionsColumn = canEditFund || canDeleteFund || canEditExpense || canDeleteExpense;

  return (
    <div>
      {error && <div style={{ color: "#b91c1c", fontSize: 13, marginBottom: 12 }}>{error}</div>}

      {entries.length === 0 ? (
        <div className="afs-empty">No activity yet.</div>
      ) : (
        <table className="sd-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Type</th>
              <th>Detail</th>
              <th style={{ textAlign: "right" }}>Amount</th>
              <th>By</th>
              {showActionsColumn && <th></th>}
            </tr>
          </thead>
          <tbody>
            {entries.map((entry) =>
              entry.kind === "fund" ? (
                <tr key={`fund-${entry.id}`}>
                  <td data-label="Date">{new Date(entry.at).toLocaleString("en-IN")}</td>
                  <td data-label="Type">
                    <span className="sd-type-fund">Funds added</span>
                  </td>
                  <td data-label="Detail">
                    {entry.note || <span className="sd-muted">—</span>}
                    {entry.reimbursedToPersonal > 0 && (
                      <span style={{ color: "#d0342c", fontSize: 12 }}> (Rs. {entry.reimbursedToPersonal.toFixed(2)} reimbursed)</span>
                    )}
                  </td>
                  <td className="sd-amount" data-label="Amount">Rs. {Number(entry.amount).toFixed(2)}</td>
                  <td data-label="By">{entry.addedByName}</td>
                  {showActionsColumn && (
                    <td>
                      <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                        {canEditFund && (
                          <button type="button" onClick={() => setEditingFund(entry)} className="afs-icon-btn" title="Edit">
                            <EditIcon />
                          </button>
                        )}
                        {canDeleteFund && (
                          <button type="button" onClick={() => deleteFund(entry)} disabled={busyId === entry.id} className="afs-icon-btn danger" title="Delete">
                            <TrashIcon />
                          </button>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              ) : (
                <tr key={`expense-${entry.id}`}>
                  <td data-label="Date">{new Date(entry.at).toLocaleDateString("en-IN")}</td>
                  <td data-label="Type">
                    <div className="sd-type-cell">
                      Expense
                      <span className={`afs-badge afs-badge-${entry.fundType.toLowerCase()}`}>{entry.fundType}</span>
                    </div>
                  </td>
                  <td data-label="Detail">
                    {entry.category?.name || "Uncategorized"}
                    {entry.orderedBy ? ` · ordered by ${entry.orderedBy.name}` : ""}
                    {entry.note ? ` · ${entry.note}` : ""}
                  </td>
                  <td className="sd-amount" data-label="Amount">Rs. {Number(entry.amount).toFixed(2)}</td>
                  <td data-label="By">{entry.addedByName}</td>
                  {showActionsColumn && (
                    <td>
                      <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                        {canEditExpense && (
                          <button type="button" onClick={() => setEditingExpense(entry)} className="afs-icon-btn" title="Edit">
                            <EditIcon />
                          </button>
                        )}
                        {canDeleteExpense && (
                          <button type="button" onClick={() => deleteExpense(entry)} disabled={busyId === entry.id} className="afs-icon-btn danger" title="Delete">
                            <TrashIcon />
                          </button>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              )
            )}
          </tbody>
        </table>
      )}

      {editingFund && <EditFundModal siteId={siteId} fund={{ id: editingFund.id, amount: editingFund.amount, note: editingFund.note }} onClose={() => setEditingFund(null)} />}

      {editingExpense && (
        <EditExpenseModal
          expense={
            {
              id: editingExpense.id,
              date: editingExpense.date,
              amount: editingExpense.amount,
              note: editingExpense.note,
              category: editingExpense.category,
              orderedBy: editingExpense.orderedBy,
            } satisfies EditableExpense
          }
          categories={categories}
          orderedByPeople={orderedByPeople}
          onClose={() => setEditingExpense(null)}
        />
      )}
    </div>
  );
}
