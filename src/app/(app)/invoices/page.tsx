import Link from "next/link";
import { getServerSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import InvoiceTable, { InvoiceRow } from "./InvoiceTable";

export default async function InvoicesPage() {
  const session = await getServerSession();
  const [invoices, archivedCount] = await Promise.all([
    prisma.invoice.findMany({
      where: { tenantId: session!.tenantId, archivedAt: null },
      include: {
        customer: { select: { name: true } },
        saleInvoicesFromProforma: { select: { id: true, number: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.invoice.count({ where: { tenantId: session!.tenantId, archivedAt: { not: null } } }),
  ]);

  const rows: InvoiceRow[] = invoices.map((inv) => ({
    id: inv.id,
    number: inv.number,
    typeLabel:
      inv.type === "PROFORMA" ? "Proforma" : inv.type === "QUOTATION" ? "Quotation" : inv.isServiceInvoice ? "Service" : "Sale",
    customerName: inv.customer.name,
    date: new Date(inv.date).toLocaleDateString("en-IN"),
    total: Number(inv.total).toFixed(2),
    status: inv.status,
    // A GST return reports outward supplies, so only issued sale invoices can be picked.
    eligible: inv.type === "SALE" && inv.status !== "DRAFT",
    gstJsonName: inv.gstJsonName,
    convertedTo: inv.saleInvoicesFromProforma,
  }));

  return (
    <div>
      <div className="afs-page-header">
        <div>
          <h1 className="afs-page-title">Invoices</h1>
          <p className="afs-page-subtitle">Sales invoices, quotations, and proforma quotes</p>
        </div>
        <div className="afs-page-header-actions">
          <Link href="/invoices/archived" style={{ fontSize: 13 }}>
            Archive {archivedCount > 0 ? `(${archivedCount})` : ""}
          </Link>
          <Link href="/invoices/new?type=QUOTATION" className="afs-btn" style={{ background: "#e5e7eb", color: "#333" }}>
            + New Quotation
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
          <InvoiceTable invoices={rows} />
        )}
      </div>
    </div>
  );
}
