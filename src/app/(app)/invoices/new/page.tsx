import { getServerSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import CreateInvoiceForm from "./CreateInvoiceForm";

export default async function NewInvoicePage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; customerId?: string; service?: string }>;
}) {
  const session = await getServerSession();
  const { type, customerId, service } = await searchParams;

  const [tenant, customers, items, sites] = await Promise.all([
    prisma.tenant.findUniqueOrThrow({ where: { id: session!.tenantId } }),
    prisma.customer.findMany({ where: { tenantId: session!.tenantId, archivedAt: null }, orderBy: { name: "asc" } }),
    prisma.item.findMany({ where: { tenantId: session!.tenantId, archivedAt: null }, orderBy: { name: "asc" } }),
    prisma.site.findMany({ where: { tenantId: session!.tenantId, archivedAt: null }, orderBy: { name: "asc" } }),
  ]);

  const invoiceType = type === "PROFORMA" ? "PROFORMA" : type === "QUOTATION" ? "QUOTATION" : "SALE";
  // Service invoices are a SALE variant (same numbering/ledger behavior), not a
  // separate document type -- the flag only changes the printed heading.
  const isServiceInvoice = invoiceType === "SALE" && service === "1";

  return (
    <div>
      <h1 className="afs-page-title">
        {invoiceType === "PROFORMA"
          ? "New Proforma Invoice"
          : invoiceType === "QUOTATION"
            ? "New Quotation"
            : isServiceInvoice
              ? "New Service Tax Invoice"
              : "New Sale Invoice"}
      </h1>
      <p className="afs-page-subtitle">
        {invoiceType === "PROFORMA"
          ? "A quote for the customer to accept -- doesn't post to the ledger until converted to a sale invoice."
          : invoiceType === "QUOTATION"
            ? "An informal price quote sent before any commitment -- doesn't post to the ledger and has its own numbering series."
            : "Raises a real GST invoice and posts the due amount to the customer's ledger."}
      </p>

      <div className="afs-card">
        <CreateInvoiceForm
          type={invoiceType}
          isServiceInvoice={isServiceInvoice}
          tenantStateCode={tenant.stateCode}
          customers={customers.map((c) => ({ id: c.id, name: c.name, stateCode: c.stateCode }))}
          items={items.map((i) => ({
            id: i.id,
            name: i.name,
            description: i.description ?? undefined,
            hsnCode: i.hsnCode,
            unit: i.unit,
            salePrice: Number(i.salePrice),
            taxRate: Number(i.taxRate),
          }))}
          defaultCustomerId={customerId}
          sites={sites.map((s) => ({ id: s.id, name: s.name }))}
        />
      </div>
    </div>
  );
}
