import Link from "next/link";
import { notFound } from "next/navigation";
import { getServerSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import CreatePurchaseForm from "../../new/CreatePurchaseForm";

function dateInputValue(d: Date | null): string {
  return d ? d.toISOString().slice(0, 10) : "";
}

export default async function EditPurchasePage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession();
  const { id } = await params;

  const [purchase, tenant, vendors, items, sites] = await Promise.all([
    prisma.purchase.findFirst({
      where: { id, tenantId: session!.tenantId },
      include: { lines: true, vendor: true, vendorPayments: true },
    }),
    prisma.tenant.findUniqueOrThrow({ where: { id: session!.tenantId } }),
    // Not filtered by archivedAt: same reasoning as the invoice edit page -- this page can
    // be editing an old bill whose vendor has since been archived, and the vendor field
    // here is read-only display, not a picker, so it still needs to resolve that name.
    prisma.vendor.findMany({ where: { tenantId: session!.tenantId }, orderBy: { name: "asc" } }),
    prisma.item.findMany({ where: { tenantId: session!.tenantId, archivedAt: null }, orderBy: { name: "asc" } }),
    prisma.site.findMany({ where: { tenantId: session!.tenantId, archivedAt: null }, orderBy: { name: "asc" } }),
  ]);

  if (!purchase) notFound();

  const hasSuccessfulPayment = purchase.vendorPayments.some((p) => p.status === "SUCCESS");
  const editable = !purchase.archivedAt && !hasSuccessfulPayment;

  if (!editable) {
    return (
      <div>
        <p style={{ marginBottom: 12 }}>
          <Link href={`/purchases/${purchase.id}`} style={{ fontSize: 13 }}>
            ← Back to {purchase.number}
          </Link>
        </p>
        <div className="afs-card">
          <div className="afs-empty">
            {purchase.archivedAt
              ? "This purchase bill is archived and can't be edited."
              : "This purchase bill already has a payment recorded against it, so its totals can no longer be changed."}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <h1 className="afs-page-title">Edit {purchase.number}</h1>
      <p className="afs-page-subtitle">Purchase bill from {purchase.vendor.name}</p>

      <div className="afs-card">
        <CreatePurchaseForm
          tenantStateCode={tenant.stateCode}
          vendors={vendors.map((v) => ({ id: v.id, name: v.name, stateCode: v.stateCode }))}
          items={items.map((i) => ({
            id: i.id,
            name: i.name,
            hsnCode: i.hsnCode,
            unit: i.unit,
            purchasePrice: i.purchasePrice ? Number(i.purchasePrice) : Number(i.salePrice),
            taxRate: Number(i.taxRate),
          }))}
          defaultVendorId={purchase.vendorId}
          editPurchaseId={purchase.id}
          sites={sites.map((s) => ({ id: s.id, name: s.name }))}
          initialValues={{
            discount: Number(purchase.discount).toString(),
            dueDate: dateInputValue(purchase.dueDate),
            vendorBillNumber: purchase.vendorBillNumber ?? "",
            siteId: purchase.siteId ?? "",
            lines: purchase.lines.map((l) => ({
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
