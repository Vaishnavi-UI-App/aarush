import { notFound } from "next/navigation";
import { getServerSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import PurchaseBillTemplate from "@/components/PurchaseBillTemplate";
import { toPurchaseTemplateData } from "@/lib/purchase-template-data";
import "@/components/invoice.css";

export default async function PrintPurchasePage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession();
  if (!session) notFound();

  const { id } = await params;

  const [purchase, tenant] = await Promise.all([
    prisma.purchase.findFirst({
      where: { id, tenantId: session.tenantId },
      include: { lines: true, vendor: true },
    }),
    prisma.tenant.findUniqueOrThrow({ where: { id: session.tenantId } }),
  ]);

  if (!purchase) notFound();

  return <PurchaseBillTemplate bill={toPurchaseTemplateData(purchase, tenant)} />;
}
