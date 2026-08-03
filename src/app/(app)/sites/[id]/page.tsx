import { notFound, redirect } from "next/navigation";
import { getServerSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { canAccessFinance } from "@/lib/permissions";
import FundSiteForm from "./FundSiteForm";

export default async function SiteDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession();
  if (!(await canAccessFinance(session!.tenantId, session!.role))) redirect("/dashboard");
  const { id } = await params;

  const site = await prisma.site.findFirst({
    where: { id, tenantId: session!.tenantId },
    include: {
      wallet: true,
      fundAllocations: { orderBy: { createdAt: "desc" }, include: { addedBy: { select: { name: true, email: true } } } },
      expenses: {
        orderBy: { date: "desc" },
        include: { category: true, orderedBy: true, addedBy: { select: { name: true, email: true } } },
      },
    },
  });
  if (!site) notFound();

  const wallet = site.wallet;
  const pending = wallet ? Number(wallet.totalPersonalSpent) - Number(wallet.totalPersonalReimbursed) : 0;

  // Merge fund allocations and expenses into one chronological timeline.
  const timeline = [
    ...site.fundAllocations.map((f) => ({ kind: "fund" as const, at: f.createdAt, item: f })),
    ...site.expenses.map((e) => ({ kind: "expense" as const, at: e.date, item: e })),
  ].sort((a, b) => b.at.getTime() - a.at.getTime());

  return (
    <div>
      <h1 className="afs-page-title">{site.name}</h1>
      <p className="afs-page-subtitle">{site.address || "No address on file"}</p>

      <div className="afs-card" style={{ marginTop: 20, marginBottom: 20, display: "flex", gap: 24, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontSize: 12, color: "#6b7280" }}>Company balance</div>
          <div style={{ fontSize: 20, fontWeight: 700 }}>Rs. {Number(wallet?.companyBalance ?? 0).toFixed(2)}</div>
        </div>
        <div>
          <div style={{ fontSize: 12, color: "#6b7280" }}>Total funds received</div>
          <div style={{ fontSize: 20, fontWeight: 700 }}>Rs. {Number(wallet?.totalFundsReceived ?? 0).toFixed(2)}</div>
        </div>
        <div>
          <div style={{ fontSize: 12, color: "#6b7280" }}>Total spent</div>
          <div style={{ fontSize: 20, fontWeight: 700 }}>
            Rs. {(Number(wallet?.totalCompanySpent ?? 0) + Number(wallet?.totalPersonalSpent ?? 0)).toFixed(2)}
          </div>
        </div>
        {pending > 0 && (
          <div>
            <div style={{ fontSize: 12, color: "#9e1b1f" }}>Pending reimbursement</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: "#9e1b1f" }}>Rs. {pending.toFixed(2)}</div>
          </div>
        )}
      </div>

      <div className="afs-card" style={{ marginBottom: 20 }}>
        <FundSiteForm siteId={site.id} />
      </div>

      <div className="afs-card">
        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>History</div>
        {timeline.length === 0 ? (
          <div className="afs-empty">No activity yet.</div>
        ) : (
          <table className="afs-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Type</th>
                <th>Detail</th>
                <th>Amount</th>
                <th>By</th>
              </tr>
            </thead>
            <tbody>
              {timeline.map((entry) =>
                entry.kind === "fund" ? (
                  <tr key={`fund-${entry.item.id}`}>
                    <td>{new Date(entry.at).toLocaleString("en-IN")}</td>
                    <td>Funds added</td>
                    <td>
                      {entry.item.note || "—"}
                      {Number(entry.item.reimbursedToPersonal) > 0 && (
                        <span style={{ color: "#9e1b1f", fontSize: 12 }}>
                          {" "}
                          (Rs. {Number(entry.item.reimbursedToPersonal).toFixed(2)} reimbursed)
                        </span>
                      )}
                    </td>
                    <td>Rs. {Number(entry.item.amount).toFixed(2)}</td>
                    <td>{entry.item.addedBy.name || entry.item.addedBy.email}</td>
                  </tr>
                ) : (
                  <tr key={`expense-${entry.item.id}`}>
                    <td>{new Date(entry.at).toLocaleDateString("en-IN")}</td>
                    <td>
                      Expense
                      <span className={`afs-badge afs-badge-${entry.item.fundType.toLowerCase()}`} style={{ marginLeft: 6 }}>
                        {entry.item.fundType}
                      </span>
                    </td>
                    <td>
                      {entry.item.category?.name || "Uncategorized"}
                      {entry.item.orderedBy ? ` · ordered by ${entry.item.orderedBy.name}` : ""}
                      {entry.item.note ? ` · ${entry.item.note}` : ""}
                    </td>
                    <td>Rs. {Number(entry.item.amount).toFixed(2)}</td>
                    <td>{entry.item.addedBy.name || entry.item.addedBy.email}</td>
                  </tr>
                )
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
