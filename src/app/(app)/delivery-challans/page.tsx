import Link from "next/link";
import { getServerSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { ViewIcon, DownloadIcon } from "@/components/icons";

export default async function DeliveryChallansPage() {
  const session = await getServerSession();
  const challans = await prisma.deliveryChallan.findMany({
    where: { tenantId: session!.tenantId, archivedAt: null },
    include: { customer: { select: { name: true } }, lines: true },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <h1 className="afs-page-title">Delivery Challans</h1>
          <p className="afs-page-subtitle">Dispatch documents for goods sent to a customer</p>
        </div>
        <Link href="/delivery-challans/new" className="afs-btn afs-btn-primary">
          + New Delivery Challan
        </Link>
      </div>

      <div className="afs-card" style={{ marginTop: 20 }}>
        {challans.length === 0 ? (
          <div className="afs-empty">No delivery challans yet.</div>
        ) : (
          <table className="afs-table">
            <thead>
              <tr>
                <th>Number</th>
                <th>Date</th>
                <th>To</th>
                <th>Vehicle No.</th>
                <th>Total Qty</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {challans.map((c) => {
                const totalQty = c.lines.reduce((sum, l) => sum + Number(l.qty), 0);
                return (
                  <tr key={c.id}>
                    <td>
                      <Link href={`/delivery-challans/${c.id}`}>{c.number}</Link>
                    </td>
                    <td>{new Date(c.date).toLocaleDateString("en-IN")}</td>
                    <td>{c.toName ?? c.customer?.name ?? "—"}</td>
                    <td>{c.vehicleNumber ?? "—"}</td>
                    <td>{totalQty}</td>
                    <td>
                      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                        <Link href={`/delivery-challans/${c.id}`} className="afs-icon-btn" title="View">
                          <ViewIcon />
                        </Link>
                        <a
                          href={`/api/delivery-challans/${c.id}/pdf`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="afs-icon-btn"
                          title="Download PDF"
                        >
                          <DownloadIcon />
                        </a>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
