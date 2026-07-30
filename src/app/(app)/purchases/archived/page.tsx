import Link from "next/link";
import { getServerSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import RestorePurchaseButton from "./RestorePurchaseButton";

function badgeClass(status: string) {
  return `afs-badge afs-badge-${status.toLowerCase()}`;
}

export default async function ArchivedPurchasesPage() {
  const session = await getServerSession();
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
                <th></th>
              </tr>
            </thead>
            <tbody>
              {purchases.map((p) => (
                <tr key={p.id}>
                  <td>{p.number}</td>
                  <td>{p.vendor.name}</td>
                  <td>Rs. {Number(p.total).toFixed(2)}</td>
                  <td>
                    <span className={badgeClass(p.status)}>{p.status.replace("_", " ")}</span>
                  </td>
                  <td>{p.archivedAt ? new Date(p.archivedAt).toLocaleDateString("en-IN") : "—"}</td>
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
