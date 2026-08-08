import { notFound } from "next/navigation";
import { getServerSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import DeliveryChallanTemplate from "@/components/DeliveryChallanTemplate";
import { toDeliveryChallanTemplateData } from "@/lib/delivery-challan-to-template-data";
import "@/components/delivery-challan.css";

export default async function PrintDeliveryChallanPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession();
  if (!session) notFound();

  const { id } = await params;

  const [challan, tenant] = await Promise.all([
    prisma.deliveryChallan.findFirst({
      where: { id, tenantId: session.tenantId },
      include: { lines: true, customer: true, site: true },
    }),
    prisma.tenant.findUniqueOrThrow({ where: { id: session.tenantId } }),
  ]);

  if (!challan) notFound();

  return <DeliveryChallanTemplate challan={toDeliveryChallanTemplateData(challan, tenant)} />;
}
