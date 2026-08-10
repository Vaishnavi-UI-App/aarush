import Link from "next/link";
import { getServerSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/permissions";
import { ViewIcon } from "@/components/icons";
import DeleteDeliveryChallanButton from "./DeleteDeliveryChallanButton";

export default async function DeliveryChallansPage() {
  const session = await getServerSession();
  const [challans, canDelete] = await Promise.all([
    prisma.deliveryChallan.findMany({
      where: { tenantId: session!.tenantId, archivedAt: null },
      include: { customer: { select: { name: true } }, lines: true },
      orderBy: { createdAt: "desc" },
    }),
    can(session!.tenantId, session!.roleId, "deliveryChallans", "delete"),
  ]);

  return (
    <div>
      <div className="afs-page-header">
        <div>
          <h1 className="afs-page-title">Delivery Challans</h1>
          <p className="afs-page-subtitle">Dispatch documents for goods sent to a customer</p>
        </div>
        <div className="afs-page-header-actions">
          <Link href="/delivery-challans/new" className="afs-btn afs-btn-primary">
            + New Delivery Challan
          </Link>
        </div>
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
                    <td data-label="Number">
                      <Link href={`/delivery-challans/${c.id}`}>{c.number}</Link>
                    </td>
                    <td data-label="Date">{new Date(c.date).toLocaleDateString("en-IN")}</td>
                    <td data-label="To">{c.toName ?? c.customer?.name ?? "—"}</td>
                    <td data-label="Vehicle No.">{c.vehicleNumber ?? "—"}</td>
                    <td data-label="Total Qty">{totalQty}</td>
                    <td>
                      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                        <Link href={`/delivery-challans/${c.id}`} className="afs-icon-btn view" title="View">
                          <ViewIcon />
                        </Link>
                        {canDelete && <DeleteDeliveryChallanButton challanId={c.id} challanNumber={c.number} />}
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
