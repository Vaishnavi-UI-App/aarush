import { getServerSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import NewCustomerForm from "./NewCustomerForm";

export default async function CustomersPage() {
  const session = await getServerSession();
  const customers = await prisma.customer.findMany({
    where: { tenantId: session!.tenantId },
    orderBy: { name: "asc" },
  });

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
              </tr>
            </thead>
            <tbody>
              {customers.map((c) => (
                <tr key={c.id}>
                  <td>
                    <a href={`/customers/${c.id}`}>{c.name}</a>
                  </td>
                  <td>{c.gstin ?? "—"}</td>
                  <td>{c.stateCode}</td>
                  <td>{c.phone ?? "—"}</td>
                  <td>{c.email ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
