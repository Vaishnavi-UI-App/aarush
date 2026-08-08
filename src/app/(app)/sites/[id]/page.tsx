import { notFound, redirect } from "next/navigation";
import { getServerSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/permissions";
import { BankIcon, ArrowUpIcon, ArrowDownIcon, HelpCircleIcon } from "@/components/icons";
import FundSiteForm from "./FundSiteForm";
import SiteHistoryTable, { HistoryEntry } from "./SiteHistoryTable";
import "./site-detail.css";

export default async function SiteDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession();
  if (!(await can(session!.tenantId, session!.roleId, "sites", "view"))) redirect("/dashboard");
  const { id } = await params;

  const [site, canEditFund, canDeleteFund, canEditExpense, canDeleteExpense, categories, orderedByPeople] = await Promise.all([
    prisma.site.findFirst({
      where: { id, tenantId: session!.tenantId },
      include: {
        wallet: true,
        fundAllocations: { orderBy: { createdAt: "desc" }, include: { addedBy: { select: { name: true, email: true } } } },
        expenses: {
          orderBy: { date: "desc" },
          include: { category: true, orderedBy: true, addedBy: { select: { name: true, email: true } } },
        },
      },
    }),
    can(session!.tenantId, session!.roleId, "sites", "edit"),
    can(session!.tenantId, session!.roleId, "sites", "delete"),
    can(session!.tenantId, session!.roleId, "expenses", "edit"),
    can(session!.tenantId, session!.roleId, "expenses", "delete"),
    prisma.expenseCategory.findMany({ where: { tenantId: session!.tenantId }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.orderedByPerson.findMany({ where: { tenantId: session!.tenantId }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);
  if (!site) notFound();

  const wallet = site.wallet;
  const pending = wallet ? Number(wallet.totalPersonalSpent) - Number(wallet.totalPersonalReimbursed) : 0;

  // Merge fund allocations and expenses into one chronological timeline.
  const entries: HistoryEntry[] = [
    ...site.fundAllocations.map(
      (f): HistoryEntry => ({
        kind: "fund",
        id: f.id,
        at: f.createdAt.toISOString(),
        amount: f.amount.toString(),
        note: f.note,
        reimbursedToPersonal: Number(f.reimbursedToPersonal),
        addedByName: f.addedBy.name || f.addedBy.email,
      })
    ),
    ...site.expenses.map(
      (e): HistoryEntry => ({
        kind: "expense",
        id: e.id,
        at: e.date.toISOString(),
        date: e.date.toISOString(),
        amount: e.amount.toString(),
        note: e.note,
        fundType: e.fundType,
        category: e.category ? { id: e.category.id, name: e.category.name } : null,
        orderedBy: e.orderedBy ? { id: e.orderedBy.id, name: e.orderedBy.name } : null,
        addedByName: e.addedBy.name || e.addedBy.email,
      })
    ),
  ].sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());

  return (
    <div>
      <h1 className="afs-page-title">{site.name}</h1>
      <p className="afs-page-subtitle">{site.address || "No address on file"}</p>

      <div className="sd-stat-grid">
        <div className="sd-stat-card">
          <div>
            <div className="sd-stat-label">Company balance</div>
            <div className="sd-stat-value">Rs. {Number(wallet?.companyBalance ?? 0).toFixed(2)}</div>
          </div>
          <div className="sd-stat-icon sd-stat-icon-blue">
            <BankIcon />
          </div>
        </div>
        <div className="sd-stat-card">
          <div>
            <div className="sd-stat-label">Total funds received</div>
            <div className="sd-stat-value">Rs. {Number(wallet?.totalFundsReceived ?? 0).toFixed(2)}</div>
          </div>
          <div className="sd-stat-icon sd-stat-icon-green">
            <ArrowUpIcon />
          </div>
        </div>
        <div className="sd-stat-card">
          <div>
            <div className="sd-stat-label">Total spent</div>
            <div className="sd-stat-value">
              Rs. {(Number(wallet?.totalCompanySpent ?? 0) + Number(wallet?.totalPersonalSpent ?? 0)).toFixed(2)}
            </div>
          </div>
          <div className="sd-stat-icon sd-stat-icon-rose">
            <ArrowDownIcon />
          </div>
        </div>
        <div className="sd-stat-card">
          <div>
            <div className="sd-stat-label">Pending reimbursement</div>
            <div className={`sd-stat-value${pending > 0 ? " sd-stat-value-red" : ""}`}>Rs. {pending.toFixed(2)}</div>
          </div>
          <div className="sd-stat-icon sd-stat-icon-amber">
            <HelpCircleIcon />
          </div>
        </div>
      </div>

      <div className="afs-card" style={{ marginBottom: 20 }}>
        <FundSiteForm siteId={site.id} />
      </div>

      <div className="afs-card">
        <div className="sd-history-title">History</div>
        <SiteHistoryTable
          siteId={site.id}
          entries={entries}
          canEditFund={canEditFund}
          canDeleteFund={canDeleteFund}
          canEditExpense={canEditExpense}
          canDeleteExpense={canDeleteExpense}
          categories={categories}
          orderedByPeople={orderedByPeople}
        />
      </div>
    </div>
  );
}
