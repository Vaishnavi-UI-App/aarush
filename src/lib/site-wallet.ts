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
