import { getServerSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import NewDeliveryChallanForm from "./NewDeliveryChallanForm";

export default async function NewDeliveryChallanPage() {
  const session = await getServerSession();

  const [customers, sites] = await Promise.all([
    prisma.customer.findMany({ where: { tenantId: session!.tenantId }, orderBy: { name: "asc" } }),
    prisma.site.findMany({ where: { tenantId: session!.tenantId, archivedAt: null }, orderBy: { name: "asc" } }),
  ]);

  return (
    <div>
      <h1 className="afs-page-title">New Delivery Challan</h1>
      <p className="afs-page-subtitle">Dispatch document for goods sent to a customer -- not a tax document</p>

      <div className="afs-card">
        <NewDeliveryChallanForm
          customers={customers.map((c) => ({ id: c.id, name: c.name, address: c.address }))}
          sites={sites.map((s) => ({ id: s.id, name: s.name }))}
        />
      </div>
    </div>
  );
}
