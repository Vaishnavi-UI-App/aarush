"use client";

import { useState } from "react";
import Link from "next/link";
import { PinIcon } from "@/components/icons";
import NewExpenseForm from "./NewExpenseForm";
import FundCompanyForm from "./FundCompanyForm";

interface Option {
  id: string;
  name: string;
}

export default function ExpenseActionsBar({
  sites,
  categories,
  orderedByPeople,
}: {
  sites: Option[];
  categories: Option[];
  orderedByPeople: Option[];
}) {
  const [modal, setModal] = useState<"fund" | "expense" | null>(null);

  return (
    <>
      <div className="exp-header-actions">
        <Link href="/sites" className="afs-btn exp-btn-outline">
          <PinIcon /> Add Site
        </Link>
        <button type="button" onClick={() => setModal("fund")} className="afs-btn exp-btn-blue">
          ⬇ Add Company Funds
        </button>
        <button type="button" onClick={() => setModal("expense")} className="afs-btn afs-btn-primary">
          + Add Expense
        </button>
      </div>

      {modal && (
        <div className="afs-modal-backdrop" onClick={() => setModal(null)}>
          <div className="afs-modal" onClick={(e) => e.stopPropagation()}>
            <h2>{modal === "fund" ? "Add Company Funds" : "Add Expense"}</h2>
            {modal === "fund" ? (
              <FundCompanyForm sites={sites} />
            ) : (
              <NewExpenseForm sites={sites} categories={categories} orderedByPeople={orderedByPeople} />
            )}
          </div>
        </div>
      )}
    </>
  );
}
