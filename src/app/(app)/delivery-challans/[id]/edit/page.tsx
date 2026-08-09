import Link from "next/link";
import { notFound } from "next/navigation";
import { getServerSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import NewDeliveryChallanForm from "../../new/NewDeliveryChallanForm";

function dateInputValue(d: Date | null): string {
  return d ? d.toISOString().slice(0, 10) : "";
}

export default async function EditDeliveryChallanPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession();
  const { id } = await params;

  const [challan, customers, sites] = await Promise.all([
    prisma.deliveryChallan.findFirst({
      where: { id, tenantId: session!.tenantId },
      include: { lines: true, customer: true },
    }),
    // Not filtered by archivedAt: this page can be editing an old challan whose customer
    // has since been archived -- it still needs to appear in the picker so the current
    // selection resolves, same reasoning as the invoice edit page.
    prisma.customer.findMany({ where: { tenantId: session!.tenantId }, orderBy: { name: "asc" } }),
    prisma.site.findMany({ where: { tenantId: session!.tenantId, archivedAt: null }, orderBy: { name: "asc" } }),
  ]);

  if (!challan) notFound();

  if (challan.archivedAt) {
    return (
      <div>
        <p style={{ marginBottom: 12 }}>
          <Link href={`/delivery-challans/${challan.id}`} style={{ fontSize: 13 }}>
            ← Back to {challan.number}
          </Link>
        </p>
        <div className="afs-card">
          <div className="afs-empty">This delivery challan is archived and can&apos;t be edited.</div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <h1 className="afs-page-title">Edit {challan.number}</h1>
      <p className="afs-page-subtitle">Dispatch document for goods sent to a customer -- not a tax document</p>

      <div className="afs-card">
        <NewDeliveryChallanForm
          customers={customers.map((c) => ({ id: c.id, name: c.name, address: c.address }))}
          sites={sites.map((s) => ({ id: s.id, name: s.name }))}
          editChallanId={challan.id}
          initialValues={{
            customerId: challan.customerId ?? "",
            siteId: challan.siteId ?? "",
            toName: challan.toName ?? "",
            toAddress: challan.toAddress ?? "",
            poNumber: challan.poNumber ?? "",
            poDate: dateInputValue(challan.poDate),
            vehicleNumber: challan.vehicleNumber ?? "",
            lines: challan.lines.map((l) => ({
              particulars: l.particulars,
              qty: Number(l.qty).toString(),
              unit: l.unit,
            })),
          }}
        />
      </div>
    </div>
  );
}
