import Link from "next/link";
import { getServerSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import InvoiceRowActions from "./InvoiceRowActions";

function badgeClass(status: string) {
  return `afs-badge afs-badge-${status.toLowerCase()}`;
}

export default async function InvoicesPage() {
  const session = await getServerSession();
  const [invoices, archivedCount] = await Promise.all([
    prisma.invoice.findMany({
      where: { tenantId: session!.tenantId, archivedAt: null },
      include: {
        customer: { select: { name: true } },
        convertedToInvoice: { select: { id: true, number: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.invoice.count({ where: { tenantId: session!.tenantId, archivedAt: { not: null } } }),
  ]);

  return (
    <div>
      <div className="afs-page-header">
        <div>
          <h1 className="afs-page-title">Invoices</h1>
          <p className="afs-page-subtitle">Sales invoices and proforma quotes</p>
        </div>
        <div className="afs-page-header-actions">
          <Link href="/invoices/archived" style={{ fontSize: 13 }}>
            Archive {archivedCount > 0 ? `(${archivedCount})` : ""}
          </Link>
          <Link href="/invoices/new?type=PROFORMA" className="afs-btn afs-btn-gold">
            + New Proforma
          </Link>
          <Link href="/invoices/new" className="afs-btn afs-btn-primary">
            + New Sale Invoice
          </Link>
          <Link href="/invoices/new?service=1" className="afs-btn afs-btn-primary">
            + New Service Tax Invoice
          </Link>
        </div>
      </div>

      <div className="afs-card" style={{ marginTop: 20 }}>
        {invoices.length === 0 ? (
          <div className="afs-empty">No invoices yet.</div>
        ) : (
          <table className="afs-table">
            <thead>
              <tr>
                <th>Number</th>
                <th>Type</th>
                <th>Customer</th>
                <th>Date</th>
                <th>Total</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((inv) => (
                <tr key={inv.id}>
                  <td data-label="Number">
                    <Link href={`/invoices/${inv.id}`}>{inv.number}</Link>
                  </td>
                  <td data-label="Type">{inv.type === "PROFORMA" ? "Proforma" : inv.isServiceInvoice ? "Service" : "Sale"}</td>
                  <td data-label="Customer">{inv.customer.name}</td>
                  <td data-label="Date">{new Date(inv.date).toLocaleDateString("en-IN")}</td>
                  <td data-label="Total">Rs. {Number(inv.total).toFixed(2)}</td>
                  <td data-label="Status">
                    <span className={badgeClass(inv.status)}>{inv.status.replace("_", " ")}</span>
                  </td>
                  <td>
                    {inv.convertedToInvoice ? (
                      <span style={{ fontSize: 12, color: "#667" }}>
                        Converted →{" "}
                        <Link href={`/invoices/${inv.convertedToInvoice.id}`}>{inv.convertedToInvoice.number}</Link>
                      </span>
                    ) : (
                      <InvoiceRowActions invoiceId={inv.id} />
                    )}
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
