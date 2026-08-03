import { redirect } from "next/navigation";
import { getServerSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { canAccessFinance } from "@/lib/permissions";
import NewVendorForm from "./NewVendorForm";

export default async function VendorsPage() {
  const session = await getServerSession();
  if (!(await canAccessFinance(session!.tenantId, session!.role))) redirect("/dashboard");
  const vendors = await prisma.vendor.findMany({
    where: { tenantId: session!.tenantId },
    orderBy: { name: "asc" },
  });

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
              </tr>
            </thead>
            <tbody>
              {vendors.map((v) => (
                <tr key={v.id}>
                  <td>
                    <a href={`/vendors/${v.id}`}>{v.name}</a>
                  </td>
                  <td>{v.gstin ?? "—"}</td>
                  <td>{v.stateCode}</td>
                  <td>{v.phone ?? "—"}</td>
                  <td>{v.email ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
