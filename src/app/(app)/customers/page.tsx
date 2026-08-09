import Link from "next/link";
import { getServerSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/permissions";
import NewCustomerForm from "./NewCustomerForm";
import DeleteCustomerButton from "./DeleteCustomerButton";
import { EditIcon } from "@/components/icons";

export default async function CustomersPage() {
  const session = await getServerSession();
  const [customers, canDelete] = await Promise.all([
    prisma.customer.findMany({
      where: { tenantId: session!.tenantId, archivedAt: null },
      orderBy: { name: "asc" },
    }),
    can(session!.tenantId, session!.roleId, "customers", "delete"),
  ]);

  return (
    <div>
      <h1 className="afs-page-title">Customers</h1>
      <p className="afs-page-subtitle">Everyone you bill, and their GST state for CGST/SGST vs IGST</p>

      <div className="afs-card" style={{ marginBottom: 20 }}>
        <NewCustomerForm />
      </div>

      <div className="afs-card">
        {customers.length === 0 ? (
          <div className="afs-empty">No customers yet.</div>
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
              {customers.map((c) => (
                <tr key={c.id}>
                  <td data-label="Name">
                    <a href={`/customers/${c.id}`}>{c.name}</a>
                  </td>
                  <td data-label="GSTIN">{c.gstin ?? "—"}</td>
                  <td data-label="State code">{c.stateCode}</td>
                  <td data-label="Phone">{c.phone ?? "—"}</td>
                  <td data-label="Email">{c.email ?? "—"}</td>
                  <td>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <Link href={`/customers/${c.id}/edit`} className="afs-icon-btn" title="Edit customer">
                        <EditIcon />
                      </Link>
                      {canDelete && <DeleteCustomerButton customerId={c.id} customerName={c.name} />}
                    </div>
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
