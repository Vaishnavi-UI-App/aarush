import { notFound } from "next/navigation";
import { getServerSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/permissions";
import { buildExpenseWhere, getRestrictedSiteId } from "@/lib/expense-query";
import "@/components/expense-report.css";

export default async function PrintExpensesReportPage({
  searchParams,
}: {
  searchParams: Promise<{ siteId?: string; from?: string; to?: string }>;
}) {
  const session = await getServerSession();
  if (!session) notFound();

  const { siteId, from, to } = await searchParams;

  const addedById = (await can(session.tenantId, session.roleId, "expenses", "edit")) ? undefined : session.userId;
  const restrictedSiteId = await getRestrictedSiteId(session.tenantId, session.userId);

  const [tenant, expenses, site] = await Promise.all([
    prisma.tenant.findUniqueOrThrow({ where: { id: session.tenantId } }),
    prisma.expense.findMany({
      where: buildExpenseWhere({ tenantId: session.tenantId, siteId, from, to, addedById, restrictedSiteId }),
      include: {
        site: { select: { name: true } },
        category: { select: { name: true } },
        orderedBy: { select: { name: true } },
        addedBy: { select: { name: true, email: true } },
      },
      orderBy: { date: "desc" },
    }),
    restrictedSiteId || siteId
      ? prisma.site.findFirst({ where: { id: restrictedSiteId ?? siteId, tenantId: session.tenantId }, select: { name: true } })
      : null,
  ]);

  const total = expenses.reduce((sum, e) => sum + Number(e.amount), 0);
  const companyTotal = expenses.reduce((sum, e) => sum + Number(e.companyPaid), 0);
  const personalTotal = expenses.reduce((sum, e) => sum + Number(e.personalPaid), 0);

  const filterBits = [
    site ? `Site: ${site.name}` : "All sites",
    from ? `From ${new Date(from).toLocaleDateString("en-IN")}` : null,
    to ? `To ${new Date(to).toLocaleDateString("en-IN")}` : null,
  ].filter(Boolean);

  return (
    <div className="report-page">
      <div className="report-title">{tenant.name}</div>
      <div className="report-subtitle">
        Expense Report -- {filterBits.join(" · ")} -- Generated {new Date().toLocaleDateString("en-IN")}
      </div>

      <table className="report-table">
        <thead>
          <tr>
            <th>Date</th>
            <th>Site</th>
            <th>Category</th>
            <th>Ordered By</th>
            <th className="right">Amount</th>
            <th className="right">Company Paid</th>
            <th className="right">Personal Paid</th>
            <th className="center">Split</th>
            <th>Added By</th>
            <th>Note</th>
          </tr>
        </thead>
        <tbody>
          {expenses.map((e) => (
            <tr key={e.id}>
              <td>{new Date(e.date).toLocaleDateString("en-IN")}</td>
              <td>{e.site.name}</td>
              <td>{e.category?.name ?? "Uncategorized"}</td>
              <td>{e.orderedBy?.name ?? "—"}</td>
              <td className="right">{Number(e.amount).toFixed(2)}</td>
              <td className="right">{Number(e.companyPaid).toFixed(2)}</td>
              <td className="right">{Number(e.personalPaid).toFixed(2)}</td>
              <td className="center">{e.fundType}</td>
              <td>{e.addedBy.name || e.addedBy.email}</td>
              <td>{e.note ?? ""}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td colSpan={4} className="right">
              Total
            </td>
            <td className="right">Rs. {total.toFixed(2)}</td>
            <td className="right">Rs. {companyTotal.toFixed(2)}</td>
            <td className="right">Rs. {personalTotal.toFixed(2)}</td>
            <td colSpan={3}></td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
