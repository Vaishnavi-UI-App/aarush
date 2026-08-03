import { getServerSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { canAccessFinance } from "@/lib/permissions";
import NewExpenseForm from "./NewExpenseForm";
import AllExpensesView from "./AllExpensesView";

export default async function ExpensesPage() {
  const session = await getServerSession();

  const [sites, categories, orderedByPeople] = await Promise.all([
    prisma.site.findMany({
      where: { tenantId: session!.tenantId, archivedAt: null },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.expenseCategory.findMany({ where: { tenantId: session!.tenantId }, orderBy: { name: "asc" } }),
    prisma.orderedByPerson.findMany({ where: { tenantId: session!.tenantId }, orderBy: { name: "asc" } }),
  ]);

  if (await canAccessFinance(session!.tenantId, session!.role)) {
    return (
      <div>
        <h1 className="afs-page-title">Expenses</h1>
        <p className="afs-page-subtitle">Everyone&apos;s expenses, across all sites</p>

        <div className="afs-card" style={{ marginBottom: 20, marginTop: 20 }}>
          <NewExpenseForm sites={sites} categories={categories} orderedByPeople={orderedByPeople} />
        </div>

        <AllExpensesView sites={sites} />
      </div>
    );
  }

  const myExpenses = await prisma.expense.findMany({
    where: { tenantId: session!.tenantId, addedById: session!.userId },
    include: { site: { select: { name: true } }, category: { select: { name: true } } },
    orderBy: { date: "desc" },
    take: 50,
  });

  return (
    <div>
      <h1 className="afs-page-title">Expenses</h1>
      <p className="afs-page-subtitle">Log a site expense you paid for -- personal spend is reimbursed the next time the site is funded</p>

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
                  <td>{new Date(e.date).toLocaleDateString("en-IN")}</td>
                  <td>{e.site.name}</td>
                  <td>{e.category?.name || "Uncategorized"}</td>
                  <td>Rs. {Number(e.amount).toFixed(2)}</td>
                  <td>
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
