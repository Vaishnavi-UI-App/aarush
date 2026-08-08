import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/permissions";
import RestorePurchaseButton from "./RestorePurchaseButton";

function badgeClass(status: string) {
  return `afs-badge afs-badge-${status.toLowerCase()}`;
}

export default async function ArchivedPurchasesPage() {
  const session = await getServerSession();
  if (!(await can(session!.tenantId, session!.roleId, "purchases", "view"))) redirect("/dashboard");
  const purchases = await prisma.purchase.findMany({
    where: { tenantId: session!.tenantId, archivedAt: { not: null } },
    include: { vendor: { select: { name: true } } },
    orderBy: { archivedAt: "desc" },
  });

  return (
    <div>
      <p style={{ marginBottom: 12 }}>
        <Link href="/purchases" style={{ fontSize: 13 }}>
          ← Back to Purchases
        </Link>
      </p>
      <h1 className="afs-page-title">Archive</h1>
      <p className="afs-page-subtitle">Archived purchase bills -- restore any of these to bring them back to the main list</p>

      <div className="afs-card" style={{ marginTop: 20 }}>
        {purchases.length === 0 ? (
          <div className="afs-empty">Nothing archived.</div>
        ) : (
          <table className="afs-table">
            <thead>
              <tr>
                <th>Number</th>
                <th>Vendor</th>
                <th>Total</th>
                <th>Status</th>
                <th>Archived</th>
                <th>Reason</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {purchases.map((p) => (
                <tr key={p.id}>
                  <td data-label="Number">{p.number}</td>
                  <td data-label="Vendor">{p.vendor.name}</td>
                  <td data-label="Total">Rs. {Number(p.total).toFixed(2)}</td>
                  <td data-label="Status">
                    <span className={badgeClass(p.status)}>{p.status.replace("_", " ")}</span>
                  </td>
                  <td data-label="Archived">{p.archivedAt ? new Date(p.archivedAt).toLocaleDateString("en-IN") : "—"}</td>
                  <td data-label="Reason" style={{ fontSize: 12, color: "#667" }}>{p.archiveNote || "—"}</td>
                  <td>
                    <RestorePurchaseButton purchaseId={p.id} />
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
