import Link from "next/link";
import { notFound } from "next/navigation";
import { getServerSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import CreateInvoiceForm from "../../new/CreateInvoiceForm";

function dateInputValue(d: Date | null): string {
  return d ? d.toISOString().slice(0, 10) : "";
}

export default async function EditInvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession();
  const { id } = await params;

  const [invoice, tenant, customers, items, sites] = await Promise.all([
    prisma.invoice.findFirst({
      where: { id, tenantId: session!.tenantId },
      include: { lines: true, customer: true, payments: true },
    }),
    prisma.tenant.findUniqueOrThrow({ where: { id: session!.tenantId } }),
    prisma.customer.findMany({ where: { tenantId: session!.tenantId }, orderBy: { name: "asc" } }),
    prisma.item.findMany({ where: { tenantId: session!.tenantId, archivedAt: null }, orderBy: { name: "asc" } }),
    prisma.site.findMany({ where: { tenantId: session!.tenantId, archivedAt: null }, orderBy: { name: "asc" } }),
  ]);

  if (!invoice) notFound();

  const hasSuccessfulPayment = invoice.payments.some((p) => p.status === "SUCCESS");
  const editable =
    invoice.type !== "CREDIT_NOTE" &&
    (invoice.status === "DRAFT" || invoice.status === "SENT") &&
    !invoice.archivedAt &&
    !hasSuccessfulPayment;

  if (!editable) {
    return (
      <div>
        <p style={{ marginBottom: 12 }}>
          <Link href={`/invoices/${invoice.id}`} style={{ fontSize: 13 }}>
            ← Back to {invoice.number}
          </Link>
        </p>
        <div className="afs-card">
          <div className="afs-empty">
            {invoice.archivedAt
              ? "This invoice is archived and can't be edited."
              : hasSuccessfulPayment
                ? "This invoice already has a payment recorded against it, so its totals can no longer be changed."
                : invoice.type === "CREDIT_NOTE"
                  ? "Credit notes can't be edited."
                  : "Only draft or sent invoices can be edited."}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <h1 className="afs-page-title">Edit {invoice.number}</h1>
      <p className="afs-page-subtitle">
        {invoice.type === "PROFORMA" ? "Proforma Invoice" : invoice.isServiceInvoice ? "Service Tax Invoice" : "Sale Invoice"} for{" "}
        {invoice.customer.name}
      </p>

      <div className="afs-card">
        <CreateInvoiceForm
          type={invoice.type === "PROFORMA" ? "PROFORMA" : "SALE"}
          tenantStateCode={tenant.stateCode}
          customers={customers.map((c) => ({ id: c.id, name: c.name, stateCode: c.stateCode }))}
          items={items.map((i) => ({
            id: i.id,
            name: i.name,
            hsnCode: i.hsnCode,
            unit: i.unit,
            salePrice: Number(i.salePrice),
            taxRate: Number(i.taxRate),
          }))}
          defaultCustomerId={invoice.customerId}
          editInvoiceId={invoice.id}
          sites={sites.map((s) => ({ id: s.id, name: s.name }))}
          initialValues={{
            discount: Number(invoice.discount).toString(),
            poNumber: invoice.poNumber ?? "",
            poDate: dateInputValue(invoice.poDate),
            vehicleNumber: invoice.vehicleNumber ?? "",
            transportationMode: invoice.transportationMode ?? "",
            reverseCharge: invoice.reverseCharge,
            deliveredThrough: invoice.deliveredThrough ?? "",
            placeOfSupplySite: invoice.placeOfSupplySite ?? "",
            siteId: invoice.siteId ?? "",
            paymentTerms: invoice.paymentTerms ?? "",
            shipToSameAsBilling: invoice.shipToSameAsBilling,
            shipToName: invoice.shipToName ?? "",
            shipToAddress: invoice.shipToAddress ?? "",
            shipToGstin: invoice.shipToGstin ?? "",
            shipToStateCode: invoice.shipToStateCode ?? "",
            lines: invoice.lines.map((l) => ({
              itemId: l.itemId ?? "",
              description: l.description,
              hsnCode: l.hsnCode,
              qty: Number(l.qty).toString(),
              rate: Number(l.rate).toString(),
              taxRate: Number(l.taxRate).toString(),
            })),
          }}
        />
      </div>
    </div>
  );
}
