import { notFound } from "next/navigation";
import { getServerSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import InvoiceTemplate from "@/components/InvoiceTemplate";
import { toInvoiceTemplateData } from "@/lib/invoice-to-template-data";
import InvoiceDetailActions from "./InvoiceDetailActions";
import "@/components/invoice.css";

function badgeClass(status: string) {
  return `afs-badge afs-badge-${status.toLowerCase()}`;
}

export default async function InvoiceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession();
  const { id } = await params;

  const [invoice, tenant] = await Promise.all([
    prisma.invoice.findFirst({
      where: { id, tenantId: session!.tenantId },
      include: { lines: true, customer: true, payments: true },
    }),
    prisma.tenant.findUniqueOrThrow({ where: { id: session!.tenantId } }),
  ]);

  if (!invoice) notFound();

  const paidSoFar = invoice.payments
    .filter((p) => p.status === "SUCCESS")
    .reduce((sum, p) => sum + Number(p.amount), 0);
  const amountDue = Number(invoice.total) - paidSoFar;

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
        <div>
          <h1 className="afs-page-title">{invoice.number}</h1>
          <p className="afs-page-subtitle">
            {invoice.type === "PROFORMA" ? "Proforma Invoice" : "Sale Invoice"} for {invoice.customer.name}
          </p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span className={badgeClass(invoice.status)}>{invoice.status.replace("_", " ")}</span>
          <a href={`/api/invoices/${invoice.id}/pdf`} target="_blank" rel="noopener noreferrer" className="afs-btn afs-btn-primary">
            ⬇ Download PDF
          </a>
        </div>
      </div>

      <div className="afs-card" style={{ marginBottom: 20, padding: 20 }}>
        <InvoiceTemplate invoice={toInvoiceTemplateData(invoice, tenant)} />
      </div>

      <InvoiceDetailActions
        invoiceId={invoice.id}
        invoiceType={invoice.type}
        status={invoice.status}
        customerId={invoice.customerId}
        amountDue={amountDue}
        payments={invoice.payments.map((p) => ({
          id: p.id,
          amount: Number(p.amount),
          status: p.status,
          mode: p.mode,
        }))}
      />
    </div>
  );
}
