import { notFound, redirect } from "next/navigation";
import { getServerSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { canAccessFinance } from "@/lib/permissions";
import PurchaseDetailActions from "./PurchaseDetailActions";

function badgeClass(status: string) {
  return `afs-badge afs-badge-${status.toLowerCase()}`;
}

export default async function PurchaseDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession();
  if (!(await canAccessFinance(session!.tenantId, session!.role))) redirect("/dashboard");
  const { id } = await params;

  const purchase = await prisma.purchase.findFirst({
    where: { id, tenantId: session!.tenantId },
    include: { lines: true, vendor: true, vendorPayments: true },
  });
  if (!purchase) notFound();

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <h1 className="afs-page-title">{purchase.number}</h1>
          <p className="afs-page-subtitle">
            Purchase bill from {purchase.vendor.name}
            {purchase.vendorBillNumber ? ` · Vendor ref: ${purchase.vendorBillNumber}` : ""}
            {purchase.dueDate ? ` · Due ${new Date(purchase.dueDate).toLocaleDateString("en-IN")}` : ""}
          </p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span className={badgeClass(purchase.status)}>{purchase.status.replace("_", " ")}</span>
          <PurchaseDetailActions purchaseId={purchase.id} archived={!!purchase.archivedAt} />
        </div>
      </div>

      <div className="afs-card" style={{ marginBottom: 20 }}>
        <table className="afs-table">
          <thead>
            <tr>
              <th>Description</th>
              <th>HSN</th>
              <th>Qty</th>
              <th>Rate</th>
              <th>Taxable</th>
              <th>CGST</th>
              <th>SGST</th>
              <th>IGST</th>
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            {purchase.lines.map((l) => (
              <tr key={l.id}>
                <td>{l.description}</td>
                <td>{l.hsnCode}</td>
                <td>{Number(l.qty)}</td>
                <td>{Number(l.rate).toFixed(2)}</td>
                <td>{Number(l.taxableValue).toFixed(2)}</td>
                <td>{Number(l.cgstAmount).toFixed(2)}</td>
                <td>{Number(l.sgstAmount).toFixed(2)}</td>
                <td>{Number(l.igstAmount).toFixed(2)}</td>
                <td>{Number(l.lineTotal).toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 16 }}>
          <div style={{ minWidth: 260, fontSize: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
              <span>Subtotal</span>
              <span>Rs. {Number(purchase.subtotal).toFixed(2)}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
              <span>Discount</span>
              <span>- Rs. {Number(purchase.discount).toFixed(2)}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
              <span>CGST + SGST + IGST</span>
              <span>Rs. {(Number(purchase.cgst) + Number(purchase.sgst) + Number(purchase.igst)).toFixed(2)}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 700, fontSize: 16, borderTop: "1px solid #ddd", paddingTop: 6 }}>
              <span>Total</span>
              <span>Rs. {Number(purchase.total).toFixed(2)}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="afs-card">
        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>
          Payments made · <a href={`/vendors/${purchase.vendorId}`}>Record one from the vendor page</a>
        </div>
        {purchase.vendorPayments.length === 0 ? (
          <div className="afs-empty">No payments recorded yet.</div>
        ) : (
          <table className="afs-table">
            <thead>
              <tr>
                <th>Amount</th>
                <th>Mode</th>
                <th>Reference</th>
              </tr>
            </thead>
            <tbody>
              {purchase.vendorPayments.map((p) => (
                <tr key={p.id}>
                  <td>Rs. {Number(p.amount).toFixed(2)}</td>
                  <td>{p.mode}</td>
                  <td>{p.referenceNo ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
