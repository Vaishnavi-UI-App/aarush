import { redirect } from "next/navigation";
import { getServerSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/permissions";
import CreatePurchaseForm from "./CreatePurchaseForm";

export default async function NewPurchasePage({ searchParams }: { searchParams: Promise<{ vendorId?: string }> }) {
  const session = await getServerSession();
  if (!(await can(session!.tenantId, session!.roleId, "purchases", "add"))) redirect("/dashboard");
  const { vendorId } = await searchParams;

  const [tenant, vendors, items, sites] = await Promise.all([
    prisma.tenant.findUniqueOrThrow({ where: { id: session!.tenantId } }),
    prisma.vendor.findMany({ where: { tenantId: session!.tenantId, archivedAt: null }, orderBy: { name: "asc" } }),
    prisma.item.findMany({ where: { tenantId: session!.tenantId, archivedAt: null }, orderBy: { name: "asc" } }),
    prisma.site.findMany({ where: { tenantId: session!.tenantId, archivedAt: null }, orderBy: { name: "asc" } }),
  ]);

  return (
    <div>
      <h1 className="afs-page-title">New Purchase Bill</h1>
      <p className="afs-page-subtitle">Records a bill received from a vendor and posts what we owe them</p>

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
          defaultVendorId={vendorId}
          sites={sites.map((s) => ({ id: s.id, name: s.name }))}
        />
      </div>
    </div>
  );
}
