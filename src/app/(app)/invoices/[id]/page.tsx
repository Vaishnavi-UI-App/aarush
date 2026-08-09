import { notFound } from "next/navigation";
import { getServerSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import InvoiceTemplate from "@/components/InvoiceTemplate";
import { toInvoiceTemplateData } from "@/lib/invoice-to-template-data";
import InvoiceDetailActions from "./InvoiceDetailActions";
import InvoiceViewActions from "./InvoiceViewActions";
import { canManageUsers } from "@/lib/permissions";
import "@/components/invoice.css";

function badgeClass(status: string) {
  return `afs-badge afs-badge-${status.toLowerCase()}`;
}

export default async function InvoiceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession();
  const { id } = await params;

  const [invoice, tenant, isOwner] = await Promise.all([
    prisma.invoice.findFirst({
      where: { id, tenantId: session!.tenantId },
      include: { lines: true, customer: true, payments: true, site: true },
    }),
    prisma.tenant.findUniqueOrThrow({ where: { id: session!.tenantId } }),
    canManageUsers(session!.tenantId, session!.roleId),
  ]);

  if (!invoice) notFound();

  const hasSuccessfulPayment = invoice.payments.some((p) => p.status === "SUCCESS");
  const paidSoFar = invoice.payments
    .filter((p) => p.status === "SUCCESS")
    .reduce((sum, p) => sum + Number(p.amount), 0);
  const amountDue = Number(invoice.total) - paidSoFar;

  // Editing is only safe while nothing has been collected against the invoice yet --
  // once a payment lands, the posted ledger entry and GST totals must stay in sync
  // with what was actually charged, so we stop allowing line/total changes.
  const editable =
    invoice.type !== "CREDIT_NOTE" &&
    (invoice.status === "DRAFT" || invoice.status === "SENT") &&
    !invoice.archivedAt &&
    !hasSuccessfulPayment;

  return (
    <div>
      <div className="afs-page-header" style={{ marginBottom: 16 }}>
        <div>
          <h1 className="afs-page-title">{invoice.number}</h1>
          <p className="afs-page-subtitle">
            {invoice.type === "PROFORMA" ? "Proforma Invoice" : invoice.isServiceInvoice ? "Service Tax Invoice" : "Sale Invoice"} for{" "}
            {invoice.customer.name}
          </p>
        </div>
        <div className="afs-page-header-actions" style={{ alignItems: "center" }}>
          <span className={badgeClass(invoice.status)}>{invoice.status.replace("_", " ")}</span>
          <InvoiceViewActions
            invoiceId={invoice.id}
            invoiceNumber={invoice.number}
            invoiceStatus={invoice.status}
            total={Number(invoice.total)}
            customerPhone={invoice.customer.phone}
            customerEmail={invoice.customer.email}
            editable={editable}
            archived={!!invoice.archivedAt}
          />
        </div>
      </div>

      <div className="afs-card" style={{ marginBottom: 20, padding: 20 }}>
        <InvoiceTemplate invoice={toInvoiceTemplateData(invoice, tenant)} />
      </div>

      {isOwner && invoice.conversionNote && (
        <div className="afs-card" style={{ marginBottom: 20, padding: 16, background: "#fff7e0", border: "1px solid #e6c65c" }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: "#5c4a00", marginBottom: 4 }}>
            Internal note (visible to owner only)
          </div>
          <div style={{ fontSize: 13, color: "#5c4a00", whiteSpace: "pre-wrap" }}>{invoice.conversionNote}</div>
        </div>
      )}

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
