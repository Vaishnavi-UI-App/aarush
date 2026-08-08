import { notFound } from "next/navigation";
import { getServerSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import DeliveryChallanTemplate from "@/components/DeliveryChallanTemplate";
import { toDeliveryChallanTemplateData } from "@/lib/delivery-challan-to-template-data";
import "@/components/delivery-challan.css";

export default async function DeliveryChallanDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession();
  const { id } = await params;

  const [challan, tenant] = await Promise.all([
    prisma.deliveryChallan.findFirst({
      where: { id, tenantId: session!.tenantId },
      include: { lines: true, customer: true, site: true },
    }),
    prisma.tenant.findUniqueOrThrow({ where: { id: session!.tenantId } }),
  ]);

  if (!challan) notFound();

  return (
    <div>
      <div className="afs-page-header" style={{ marginBottom: 16 }}>
        <div>
          <h1 className="afs-page-title">{challan.number}</h1>
          <p className="afs-page-subtitle">Delivery challan for {challan.toName ?? challan.customer?.name ?? "—"}</p>
        </div>
        <div className="afs-page-header-actions">
          <a href={`/api/delivery-challans/${challan.id}/pdf`} target="_blank" rel="noopener noreferrer" className="afs-btn afs-btn-primary">
            ⬇ Download PDF
          </a>
        </div>
      </div>

      <div className="afs-card" style={{ padding: 20 }}>
        <DeliveryChallanTemplate challan={toDeliveryChallanTemplateData(challan, tenant)} />
      </div>
    </div>
  );
}
