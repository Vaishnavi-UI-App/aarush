import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { getServerSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/permissions";
import RecordVendorPaymentForm from "./RecordVendorPaymentForm";

export default async function VendorLedgerPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession();
  if (!(await can(session!.tenantId, session!.roleId, "vendors", "view"))) redirect("/dashboard");
  const { id } = await params;

  const vendor = await prisma.vendor.findFirst({ where: { id, tenantId: session!.tenantId } });
  if (!vendor) notFound();

  const entries = await prisma.ledgerEntry.findMany({
    where: { tenantId: session!.tenantId, vendorId: id },
    include: { purchase: { select: { number: true } } },
    orderBy: { createdAt: "asc" },
  });

  const currentPayable = entries.length > 0 ? Number(entries[entries.length - 1].runningBalance) : 0;

  return (
    <div>
      <h1 className="afs-page-title">{vendor.name}</h1>
      <p className="afs-page-subtitle">
        {vendor.gstin ?? "No GSTIN"} · State {vendor.stateCode} ·{" "}
        <Link href={`/purchases/new?vendorId=${vendor.id}`}>+ New purchase bill for this vendor</Link>
      </p>

      <div style={{ display: "flex", gap: 20, marginBottom: 20, flexWrap: "wrap" }}>
        <div className="afs-card" style={{ maxWidth: 260 }}>
          <div style={{ fontSize: 12, color: "#667", marginBottom: 6 }}>Current Payable</div>
          <div style={{ fontSize: 24, fontWeight: 700, color: currentPayable > 0 ? "var(--afs-maroon)" : "#14532d" }}>
            Rs. {currentPayable.toFixed(2)}
          </div>
        </div>
        <div className="afs-card" style={{ flex: 1, minWidth: 280 }}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>Record a payment made to this vendor</div>
          <RecordVendorPaymentForm vendorId={vendor.id} />
        </div>
      </div>

      <div className="afs-card">
        {entries.length === 0 ? (
          <div className="afs-empty">No transactions yet.</div>
        ) : (
          <table className="afs-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Type</th>
                <th>Description</th>
                <th>Debit (bill)</th>
                <th>Credit (paid)</th>
                <th>Balance owed</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => (
                <tr key={e.id}>
                  <td data-label="Date">{new Date(e.entryDate).toLocaleDateString("en-IN")}</td>
                  <td data-label="Type">{e.refType}</td>
                  <td data-label="Description">{e.description}</td>
                  <td data-label="Debit (bill)">{Number(e.debit) > 0 ? Number(e.debit).toFixed(2) : "—"}</td>
                  <td data-label="Credit (paid)">{Number(e.credit) > 0 ? Number(e.credit).toFixed(2) : "—"}</td>
                  <td data-label="Balance owed">{Number(e.runningBalance).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
