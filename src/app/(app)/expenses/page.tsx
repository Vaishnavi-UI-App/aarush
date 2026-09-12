import { getServerSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/permissions";
import { getRestrictedSiteId } from "@/lib/expense-query";
import NewExpenseForm from "./NewExpenseForm";
import AllExpensesView from "./AllExpensesView";
import ExpenseActionsBar from "./ExpenseActionsBar";
import ExpenseOverview from "./ExpenseOverview";
import "./expenses.css";

export default async function ExpensesPage() {
  const session = await getServerSession();
  const restrictedSiteId = await getRestrictedSiteId(session!.tenantId, session!.userId);

  const [allSites, categories, orderedByPeople] = await Promise.all([
    prisma.site.findMany({
      where: { tenantId: session!.tenantId, archivedAt: null },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.expenseCategory.findMany({ where: { tenantId: session!.tenantId }, orderBy: { name: "asc" } }),
    prisma.orderedByPerson.findMany({ where: { tenantId: session!.tenantId }, orderBy: { name: "asc" } }),
  ]);
  // A site-assigned user only ever gets their one site to pick from -- every form and
  // filter downstream just naturally has nothing else to offer, no extra UI needed.
  const sites = restrictedSiteId ? allSites.filter((s) => s.id === restrictedSiteId) : allSites;

  if (await can(session!.tenantId, session!.roleId, "expenses", "edit")) {
    const siteWallets = await prisma.site.findMany({
      where: { tenantId: session!.tenantId, archivedAt: null, ...(restrictedSiteId ? { id: restrictedSiteId } : {}) },
      orderBy: { name: "asc" },
      include: {
        wallet: true,
        expenses: {
          orderBy: { date: "desc" },
          take: 3,
          include: { category: { select: { name: true } } },
        },
        _count: { select: { expenses: true } },
      },
    });

    const companyBalance = siteWallets.reduce((sum, s) => sum + Number(s.wallet?.companyBalance ?? 0), 0);
    const companySpent = siteWallets.reduce((sum, s) => sum + Number(s.wallet?.totalCompanySpent ?? 0), 0);
    const personalSpent = siteWallets.reduce((sum, s) => sum + Number(s.wallet?.totalPersonalSpent ?? 0), 0);
    const pendingReimbursement = siteWallets.reduce(
      (sum, s) => sum + Math.max(0, Number(s.wallet?.totalPersonalSpent ?? 0) - Number(s.wallet?.totalPersonalReimbursed ?? 0)),
      0
    );

    const siteCards = siteWallets.map((s) => ({
      id: s.id,
      name: s.name,
      expenseCount: s._count.expenses,
      companyBalance: Number(s.wallet?.companyBalance ?? 0),
      totalReceived: Number(s.wallet?.totalFundsReceived ?? 0),
      companySpent: Number(s.wallet?.totalCompanySpent ?? 0),
      managerPending: Math.max(0, Number(s.wallet?.totalPersonalSpent ?? 0) - Number(s.wallet?.totalPersonalReimbursed ?? 0)),
      recentExpenses: s.expenses.map((e) => ({
        id: e.id,
        note: e.note,
        categoryName: e.category?.name ?? null,
        fundType: e.fundType,
        amount: Number(e.amount),
      })),
    }));

    return (
      <div>
        <div className="exp-header">
          <div>
            <h1 className="afs-page-title">Expense Tracker</h1>
            <p className="afs-page-subtitle">
              {restrictedSiteId ? `Company & personal fund management for ${sites[0]?.name ?? "your site"}` : "Site-wise company & personal fund management"}
            </p>
          </div>
          <ExpenseActionsBar sites={sites} categories={categories} orderedByPeople={orderedByPeople} />
        </div>

        <ExpenseOverview
          companyBalance={companyBalance}
          companySpent={companySpent}
          personalSpent={personalSpent}
          pendingReimbursement={pendingReimbursement}
          siteCards={siteCards}
        />

        <h2 className="afs-page-title" style={{ marginTop: 28 }}>
          All Expenses
        </h2>
        <AllExpensesView sites={sites} categories={categories} orderedByPeople={orderedByPeople} canEdit />
      </div>
    );
  }

  const myExpenses = await prisma.expense.findMany({
    where: { tenantId: session!.tenantId, addedById: session!.userId, ...(restrictedSiteId ? { siteId: restrictedSiteId } : {}) },
    include: { site: { select: { name: true } }, category: { select: { name: true } } },
    orderBy: { date: "desc" },
    take: 50,
  });

  return (
    <div>
      <h1 className="afs-page-title">Expenses</h1>
      <p className="afs-page-subtitle">
        Log a site expense you paid for -- personal spend is reimbursed the next time the site is funded
        {restrictedSiteId && ` (restricted to ${sites[0]?.name ?? "your site"})`}
      </p>

      <div className="afs-card" style={{ marginBottom: 20, marginTop: 20 }}>
        <NewExpenseForm sites={sites} categories={categories} orderedByPeople={orderedByPeople} />
      </div>

      <div className="afs-card">
        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>Your submitted expenses</div>
        {myExpenses.length === 0 ? (
          <div className="afs-empty">You haven&apos;t logged any expenses yet.</div>
        ) : (
          <table className="afs-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Site</th>
                <th>Category</th>
                <th>Amount</th>
                <th>Split</th>
              </tr>
            </thead>
            <tbody>
              {myExpenses.map((e) => (
                <tr key={e.id}>
                  <td data-label="Date">{new Date(e.date).toLocaleDateString("en-IN")}</td>
                  <td data-label="Site">{e.site.name}</td>
                  <td data-label="Category">{e.category?.name || "Uncategorized"}</td>
                  <td data-label="Amount">Rs. {Number(e.amount).toFixed(2)}</td>
                  <td data-label="Split">
                    <span className={`afs-badge afs-badge-${e.fundType.toLowerCase()}`}>{e.fundType}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
