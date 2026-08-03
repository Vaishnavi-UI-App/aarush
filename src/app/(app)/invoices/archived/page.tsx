import Link from "next/link";
import { getServerSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import RestoreInvoiceButton from "./RestoreInvoiceButton";

function badgeClass(status: string) {
  return `afs-badge afs-badge-${status.toLowerCase()}`;
}

export default async function ArchivedInvoicesPage() {
  const session = await getServerSession();
  const invoices = await prisma.invoice.findMany({
    where: { tenantId: session!.tenantId, archivedAt: { not: null } },
    include: { customer: { select: { name: true } } },
    orderBy: { archivedAt: "desc" },
  });

  return (
    <div>
      <p style={{ marginBottom: 12 }}>
        <Link href="/invoices" style={{ fontSize: 13 }}>
          ← Back to Invoices
        </Link>
      </p>
      <h1 className="afs-page-title">Archive</h1>
      <p className="afs-page-subtitle">Archived invoices -- restore any of these to bring them back to the main list</p>

      <div className="afs-card" style={{ marginTop: 20 }}>
        {invoices.length === 0 ? (
          <div className="afs-empty">Nothing archived.</div>
        ) : (
          <table className="afs-table">
            <thead>
              <tr>
                <th>Number</th>
                <th>Type</th>
                <th>Customer</th>
                <th>Total</th>
                <th>Status</th>
                <th>Archived</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((inv) => (
                <tr key={inv.id} className="afs-row-archived">
                  <td>{inv.number}</td>
                  <td>{inv.type === "PROFORMA" ? "Proforma" : "Sale"}</td>
                  <td>{inv.customer.name}</td>
                  <td>Rs. {Number(inv.total).toFixed(2)}</td>
                  <td>
                    <span className={badgeClass(inv.status)}>{inv.status.replace("_", " ")}</span>
                  </td>
                  <td>{inv.archivedAt ? new Date(inv.archivedAt).toLocaleDateString("en-IN") : "—"}</td>
                  <td>
                    <RestoreInvoiceButton invoiceId={inv.id} />
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
