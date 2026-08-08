import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/permissions";
import NewSiteForm from "./NewSiteForm";

export default async function SitesPage() {
  const session = await getServerSession();
  if (!(await can(session!.tenantId, session!.roleId, "sites", "view"))) redirect("/dashboard");

  const sites = await prisma.site.findMany({
    where: { tenantId: session!.tenantId, archivedAt: null },
    include: { wallet: true },
    orderBy: { name: "asc" },
  });

  return (
    <div>
      <h1 className="afs-page-title">Sites</h1>
      <p className="afs-page-subtitle">Company float per site, and what's owed back to whoever fronted personal spend</p>

      <div className="afs-card" style={{ marginBottom: 20, marginTop: 20 }}>
        <NewSiteForm />
      </div>

      <div className="afs-card">
        {sites.length === 0 ? (
          <div className="afs-empty">No sites yet.</div>
        ) : (
          <table className="afs-table">
            <thead>
              <tr>
                <th>Site</th>
                <th>Address</th>
                <th>Company balance</th>
                <th>Pending reimbursement</th>
              </tr>
            </thead>
            <tbody>
              {sites.map((s) => {
                const pending = s.wallet
                  ? Number(s.wallet.totalPersonalSpent) - Number(s.wallet.totalPersonalReimbursed)
                  : 0;
                return (
                  <tr key={s.id}>
                    <td data-label="Site">
                      <Link href={`/sites/${s.id}`}>{s.name}</Link>
                    </td>
                    <td data-label="Address">{s.address || "—"}</td>
                    <td data-label="Company balance">Rs. {Number(s.wallet?.companyBalance ?? 0).toFixed(2)}</td>
                    <td data-label="Pending reimbursement">{pending > 0 ? `Rs. ${pending.toFixed(2)}` : "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
