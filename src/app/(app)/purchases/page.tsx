import Link from "next/link";
import { getServerSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";

function badgeClass(status: string) {
  return `afs-badge afs-badge-${status.toLowerCase()}`;
}

export default async function PurchasesPage() {
  const session = await getServerSession();
  const purchases = await prisma.purchase.findMany({
    where: { tenantId: session!.tenantId },
    include: { vendor: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <h1 className="afs-page-title">Purchases</h1>
          <p className="afs-page-subtitle">Bills received from vendors</p>
        </div>
        <Link href="/purchases/new" className="afs-btn afs-btn-primary">
          + New Purchase Bill
        </Link>
      </div>

      <div className="afs-card" style={{ marginTop: 20 }}>
        {purchases.length === 0 ? (
          <div className="afs-empty">No purchase bills yet.</div>
        ) : (
          <table className="afs-table">
            <thead>
              <tr>
                <th>Number</th>
                <th>Vendor</th>
                <th>Date</th>
                <th>Total</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {purchases.map((p) => (
                <tr key={p.id}>
                  <td>
                    <Link href={`/purchases/${p.id}`}>{p.number}</Link>
                  </td>
                  <td>{p.vendor.name}</td>
                  <td>{new Date(p.date).toLocaleDateString("en-IN")}</td>
                  <td>Rs. {Number(p.total).toFixed(2)}</td>
                  <td>
                    <span className={badgeClass(p.status)}>{p.status.replace("_", " ")}</span>
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
