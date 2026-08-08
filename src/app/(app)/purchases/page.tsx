import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/permissions";
import PurchaseRowActions from "./PurchaseRowActions";

function badgeClass(status: string) {
  return `afs-badge afs-badge-${status.toLowerCase()}`;
}

export default async function PurchasesPage() {
  const session = await getServerSession();
  if (!(await can(session!.tenantId, session!.roleId, "purchases", "view"))) redirect("/dashboard");

  const [purchases, archivedCount] = await Promise.all([
    prisma.purchase.findMany({
      where: { tenantId: session!.tenantId, archivedAt: null },
      include: { vendor: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.purchase.count({ where: { tenantId: session!.tenantId, archivedAt: { not: null } } }),
  ]);

  return (
    <div>
      <div className="afs-page-header">
        <div>
          <h1 className="afs-page-title">Purchases</h1>
          <p className="afs-page-subtitle">Bills received from vendors</p>
        </div>
        <div className="afs-page-header-actions">
          <Link href="/purchases/archived" style={{ fontSize: 13 }}>
            Archive {archivedCount > 0 ? `(${archivedCount})` : ""}
          </Link>
          <Link href="/purchases/new" className="afs-btn afs-btn-primary">
            + New Purchase Bill
          </Link>
        </div>
      </div>

      <div className="afs-card" style={{ marginTop: 20 }}>
        {purchases.length === 0 ? (
          <div className="afs-empty">No purchase bills yet.</div>
        ) : (
          <table className="afs-table">
            <thead>
              <tr>
                <th>Number</th>
                <th>Vendor ref</th>
                <th>Vendor</th>
                <th>Date</th>
                <th>Due</th>
                <th>Total</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {purchases.map((p) => (
                <tr key={p.id}>
                  <td data-label="Number">
                    <Link href={`/purchases/${p.id}`}>{p.number}</Link>
                  </td>
                  <td data-label="Vendor ref">{p.vendorBillNumber ?? "—"}</td>
                  <td data-label="Vendor">{p.vendor.name}</td>
                  <td data-label="Date">{new Date(p.date).toLocaleDateString("en-IN")}</td>
                  <td data-label="Due">{p.dueDate ? new Date(p.dueDate).toLocaleDateString("en-IN") : "—"}</td>
                  <td data-label="Total">Rs. {Number(p.total).toFixed(2)}</td>
                  <td data-label="Status">
                    <span className={badgeClass(p.status)}>{p.status.replace("_", " ")}</span>
                  </td>
                  <td>
                    <PurchaseRowActions purchaseId={p.id} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
