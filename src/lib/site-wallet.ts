import { prisma } from "@/lib/prisma";
import { round2 } from "@/lib/gst-invoice";

export interface FundSiteInput {
  tenantId: string;
  siteId: string;
  addedById: string;
  amount: number;
  note?: string;
}

/** Tops up a site's company float. Any outstanding personal debt (spend the site's
 * manager fronted personally, not yet reimbursed) is cleared first; only the remainder
 * lands in the spendable company balance. A top-up never sits in the balance while the
 * manager is still owed money. */
export async function fundSite(input: FundSiteInput) {
  const { tenantId, siteId, addedById, amount, note } = input;
  if (!(amount > 0)) {
    throw new Error("Amount must be greater than zero");
  }

  return prisma.$transaction(async (tx) => {
    await tx.site.findFirstOrThrow({ where: { id: siteId, tenantId } });

    // Serialize fund/expense writes per site so two concurrent requests can't both
    // read the same "before" balance and silently drop one of them.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${siteId}))`;

    const wallet = await tx.siteWallet.findUniqueOrThrow({ where: { siteId } });

    const outstandingDebt = round2(Number(wallet.totalPersonalSpent) - Number(wallet.totalPersonalReimbursed));
    const reimbursedToPersonal = round2(Math.min(amount, Math.max(outstandingDebt, 0)));
    const addedToBalance = round2(amount - reimbursedToPersonal);

    await tx.siteWallet.update({
      where: { siteId },
      data: {
        totalFundsReceived: round2(Number(wallet.totalFundsReceived) + amount),
        totalPersonalReimbursed: round2(Number(wallet.totalPersonalReimbursed) + reimbursedToPersonal),
        companyBalance: round2(Number(wallet.companyBalance) + addedToBalance),
      },
    });

    return tx.fundAllocation.create({
      data: { tenantId, siteId, addedById, amount, reimbursedToPersonal, addedToBalance, note },
    });
  });
}

export interface RecordExpenseInput {
  tenantId: string;
  siteId: string;
  addedById: string;
  amount: number;
  categoryId?: string;
  orderedById?: string;
  date?: Date;
  note?: string;
  receiptPhotoData?: string;
}

/** Records a spend against a site. Pays from the company balance first, up to what's
 * available; anything beyond that is the manager's personal spend, owed back to them
 * the next time the site is funded (see fundSite). fundType is always derived here,
 * never trusted from the caller. */
export async function recordExpense(input: RecordExpenseInput) {
  const { tenantId, siteId, addedById, amount, categoryId, orderedById, date, note, receiptPhotoData } = input;
  if (!(amount > 0)) {
    throw new Error("Amount must be greater than zero");
  }

  return prisma.$transaction(async (tx) => {
    await tx.site.findFirstOrThrow({ where: { id: siteId, tenantId } });

    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${siteId}))`;

    const wallet = await tx.siteWallet.findUniqueOrThrow({ where: { siteId } });

    const companyPaid = round2(Math.min(amount, Math.max(Number(wallet.companyBalance), 0)));
    const personalPaid = round2(amount - companyPaid);
    const fundType = personalPaid === 0 ? "COMPANY" : companyPaid === 0 ? "PERSONAL" : "SPLIT";

    await tx.siteWallet.update({
      where: { siteId },
      data: {
        companyBalance: round2(Number(wallet.companyBalance) - companyPaid),
        totalCompanySpent: round2(Number(wallet.totalCompanySpent) + companyPaid),
        totalPersonalSpent: round2(Number(wallet.totalPersonalSpent) + personalPaid),
      },
    });

    return tx.expense.create({
      data: {
        tenantId,
        siteId,
        addedById,
        amount,
        companyPaid,
        personalPaid,
        fundType,
        categoryId,
        orderedById,
        date: date ?? new Date(),
        note,
        receiptPhotoData,
      },
      include: { site: true, category: true, orderedBy: true },
    });
  });
}

export interface UpdateExpenseInput {
  tenantId: string;
  expenseId: string;
  amount: number;
  categoryId?: string;
  orderedById?: string;
  date?: Date;
  note?: string;
}

/** Edits an existing expense's amount/category/date/note. The site can't be changed --
 * that would mean moving money between two different wallets, which is really a delete
 * + re-record, not an edit. Reverses this expense's old effect on its site's wallet
 * first (giving back the company-paid share, undoing the spent totals), then re-derives
 * companyPaid/personalPaid/fundType against the wallet's balance as it stands with the
 * old effect removed -- same derivation rule as recordExpense, just replayed. */
export async function updateExpense(input: UpdateExpenseInput) {
  const { tenantId, expenseId, amount, categoryId, orderedById, date, note } = input;
  if (!(amount > 0)) {
    throw new Error("Amount must be greater than zero");
  }

  return prisma.$transaction(async (tx) => {
    const existing = await tx.expense.findFirst({ where: { id: expenseId, tenantId } });
    if (!existing) {
      throw new Error("Expense not found");
    }

    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${existing.siteId}))`;

    const wallet = await tx.siteWallet.findUniqueOrThrow({ where: { siteId: existing.siteId } });

    const restoredBalance = round2(Number(wallet.companyBalance) + Number(existing.companyPaid));
    const restoredCompanySpent = round2(Number(wallet.totalCompanySpent) - Number(existing.companyPaid));
    const restoredPersonalSpent = round2(Number(wallet.totalPersonalSpent) - Number(existing.personalPaid));

    const companyPaid = round2(Math.min(amount, Math.max(restoredBalance, 0)));
    const personalPaid = round2(amount - companyPaid);
    const fundType = personalPaid === 0 ? "COMPANY" : companyPaid === 0 ? "PERSONAL" : "SPLIT";

    await tx.siteWallet.update({
      where: { siteId: existing.siteId },
      data: {
        companyBalance: round2(restoredBalance - companyPaid),
        totalCompanySpent: round2(restoredCompanySpent + companyPaid),
        totalPersonalSpent: round2(restoredPersonalSpent + personalPaid),
      },
    });

    return tx.expense.update({
      where: { id: expenseId },
      data: {
        amount,
        companyPaid,
        personalPaid,
        fundType,
        categoryId: categoryId ?? null,
        orderedById: orderedById ?? null,
        date: date ?? existing.date,
        note: note ?? null,
      },
      include: { site: true, category: true, orderedBy: true },
    });
  });
}

/** Deletes an expense, giving back its company-paid share to the balance and undoing
 * the spent totals -- same reversal math as updateExpense, just without a re-record. */
export async function deleteExpense(tenantId: string, expenseId: string) {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.expense.findFirst({ where: { id: expenseId, tenantId } });
    if (!existing) {
      throw new Error("Expense not found");
    }

    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${existing.siteId}))`;

    const wallet = await tx.siteWallet.findUniqueOrThrow({ where: { siteId: existing.siteId } });

    await tx.siteWallet.update({
      where: { siteId: existing.siteId },
      data: {
        companyBalance: round2(Number(wallet.companyBalance) + Number(existing.companyPaid)),
        totalCompanySpent: round2(Number(wallet.totalCompanySpent) - Number(existing.companyPaid)),
        totalPersonalSpent: round2(Number(wallet.totalPersonalSpent) - Number(existing.personalPaid)),
      },
    });

    await tx.expense.delete({ where: { id: expenseId } });
  });
}

export interface UpdateFundAllocationInput {
  tenantId: string;
  fundAllocationId: string;
  amount: number;
  note?: string;
}

/** Edits a fund allocation's amount/note. Reverses its old effect (received total,
 * personal reimbursement, company balance) then re-derives the split against the
 * wallet as it stands with the old effect removed -- same reversal-then-replay
 * pattern as updateExpense, mirrored for the funding side. */
export async function updateFundAllocation(input: UpdateFundAllocationInput) {
  const { tenantId, fundAllocationId, amount, note } = input;
  if (!(amount > 0)) {
    throw new Error("Amount must be greater than zero");
  }

  return prisma.$transaction(async (tx) => {
    const existing = await tx.fundAllocation.findFirst({ where: { id: fundAllocationId, tenantId } });
    if (!existing) {
      throw new Error("Fund allocation not found");
    }

    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${existing.siteId}))`;

    const wallet = await tx.siteWallet.findUniqueOrThrow({ where: { siteId: existing.siteId } });

    const restoredReceived = round2(Number(wallet.totalFundsReceived) - Number(existing.amount));
    const restoredReimbursed = round2(Number(wallet.totalPersonalReimbursed) - Number(existing.reimbursedToPersonal));
    const restoredBalance = round2(Number(wallet.companyBalance) - Number(existing.addedToBalance));

    const restoredOutstandingDebt = round2(Number(wallet.totalPersonalSpent) - restoredReimbursed);
    const reimbursedToPersonal = round2(Math.min(amount, Math.max(restoredOutstandingDebt, 0)));
    const addedToBalance = round2(amount - reimbursedToPersonal);

    await tx.siteWallet.update({
      where: { siteId: existing.siteId },
      data: {
        totalFundsReceived: round2(restoredReceived + amount),
        totalPersonalReimbursed: round2(restoredReimbursed + reimbursedToPersonal),
        companyBalance: round2(restoredBalance + addedToBalance),
      },
    });

    return tx.fundAllocation.update({
      where: { id: fundAllocationId },
      data: { amount, reimbursedToPersonal, addedToBalance, note: note ?? null },
      include: { addedBy: { select: { name: true, email: true } } },
    });
  });
}

/** Deletes a fund allocation, giving back exactly what it added -- undoes the received
 * total, the personal reimbursement it cleared, and the balance it topped up. */
export async function deleteFundAllocation(tenantId: string, fundAllocationId: string) {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.fundAllocation.findFirst({ where: { id: fundAllocationId, tenantId } });
    if (!existing) {
      throw new Error("Fund allocation not found");
    }

    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${existing.siteId}))`;

    const wallet = await tx.siteWallet.findUniqueOrThrow({ where: { siteId: existing.siteId } });

    await tx.siteWallet.update({
      where: { siteId: existing.siteId },
      data: {
        totalFundsReceived: round2(Number(wallet.totalFundsReceived) - Number(existing.amount)),
        totalPersonalReimbursed: round2(Number(wallet.totalPersonalReimbursed) - Number(existing.reimbursedToPersonal)),
        companyBalance: round2(Number(wallet.companyBalance) - Number(existing.addedToBalance)),
      },
    });

    await tx.fundAllocation.delete({ where: { id: fundAllocationId } });
  });
}
