import { redirect } from "next/navigation";
import { getServerSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/permissions";
import NewSiteForm from "./NewSiteForm";
import EditableSiteRow from "./EditableSiteRow";

export default async function SitesPage() {
  const session = await getServerSession();
  if (!(await can(session!.tenantId, session!.roleId, "sites", "view"))) redirect("/dashboard");

  const [sites, canEdit, canDelete] = await Promise.all([
    prisma.site.findMany({
      where: { tenantId: session!.tenantId, archivedAt: null },
      include: { wallet: true },
      orderBy: { name: "asc" },
    }),
    can(session!.tenantId, session!.roleId, "sites", "edit"),
    can(session!.tenantId, session!.roleId, "sites", "delete"),
  ]);

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
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {sites.map((s) => {
                const pending = s.wallet
                  ? Number(s.wallet.totalPersonalSpent) - Number(s.wallet.totalPersonalReimbursed)
                  : 0;
                return (
                  <EditableSiteRow
                    key={s.id}
                    canEdit={canEdit}
                    canDelete={canDelete}
                    site={{
                      id: s.id,
                      name: s.name,
                      address: s.address,
                      companyBalance: Number(s.wallet?.companyBalance ?? 0),
                      pending,
                    }}
                  />
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
