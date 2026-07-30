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
      include: { customer: { select: { name: true, phone: true, email: true } } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.invoice.count({ where: { tenantId: session!.tenantId, archivedAt: { not: null } } }),
  ]);

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <h1 className="afs-page-title">Invoices</h1>
          <p className="afs-page-subtitle">Sales invoices and proforma quotes</p>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <Link href="/invoices/archived" style={{ fontSize: 13 }}>
            Archive {archivedCount > 0 ? `(${archivedCount})` : ""}
          </Link>
          <Link href="/invoices/new?type=PROFORMA" className="afs-btn afs-btn-gold">
            + New Proforma
          </Link>
          <Link href="/invoices/new" className="afs-btn afs-btn-primary">
            + New Sale Invoice
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
                  <td>
                    <Link href={`/invoices/${inv.id}`}>{inv.number}</Link>
                  </td>
                  <td>{inv.type === "PROFORMA" ? "Proforma" : "Sale"}</td>
                  <td>{inv.customer.name}</td>
                  <td>{new Date(inv.date).toLocaleDateString("en-IN")}</td>
                  <td>Rs. {Number(inv.total).toFixed(2)}</td>
                  <td>
                    <span className={badgeClass(inv.status)}>{inv.status.replace("_", " ")}</span>
                  </td>
                  <td>
                    <InvoiceRowActions
                      invoiceId={inv.id}
                      invoiceNumber={inv.number}
                      invoiceStatus={inv.status}
                      total={Number(inv.total)}
                      customerPhone={inv.customer.phone}
                      customerEmail={inv.customer.email}
                    />
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
