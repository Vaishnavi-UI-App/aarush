import { redirect } from "next/navigation";
import { getServerSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/permissions";
import NewVendorForm from "./NewVendorForm";
import EditableVendorRow from "./EditableVendorRow";

export default async function VendorsPage() {
  const session = await getServerSession();
  if (!(await can(session!.tenantId, session!.roleId, "vendors", "view"))) redirect("/dashboard");
  const [vendors, canEdit, canDelete] = await Promise.all([
    prisma.vendor.findMany({
      where: { tenantId: session!.tenantId, archivedAt: null },
      orderBy: { name: "asc" },
    }),
    can(session!.tenantId, session!.roleId, "vendors", "edit"),
    can(session!.tenantId, session!.roleId, "vendors", "delete"),
  ]);

  return (
    <div>
      <h1 className="afs-page-title">Vendors</h1>
      <p className="afs-page-subtitle">Who you buy from, and what you owe them</p>

      <div className="afs-card" style={{ marginBottom: 20 }}>
        <NewVendorForm />
      </div>

      <div className="afs-card">
        {vendors.length === 0 ? (
          <div className="afs-empty">No vendors yet.</div>
        ) : (
          <table className="afs-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>GSTIN</th>
                <th>State code</th>
                <th>Phone</th>
                <th>Email</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {vendors.map((v) => (
                <EditableVendorRow key={v.id} vendor={v} canEdit={canEdit} canDelete={canDelete} />
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
