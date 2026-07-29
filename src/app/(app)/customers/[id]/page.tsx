import { notFound } from "next/navigation";
import Link from "next/link";
import { getServerSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";

export default async function CustomerLedgerPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession();
  const { id } = await params;

  const customer = await prisma.customer.findFirst({ where: { id, tenantId: session!.tenantId } });
  if (!customer) notFound();

  const entries = await prisma.ledgerEntry.findMany({
    where: { tenantId: session!.tenantId, customerId: id },
    include: { invoice: { select: { number: true } } },
    orderBy: { createdAt: "asc" },
  });

  const currentDue = entries.length > 0 ? Number(entries[entries.length - 1].runningBalance) : 0;

  return (
    <div>
      <h1 className="afs-page-title">{customer.name}</h1>
      <p className="afs-page-subtitle">
        {customer.gstin ?? "No GSTIN"} · State {customer.stateCode} ·{" "}
        <Link href={`/invoices/new?customerId=${customer.id}`}>+ New invoice for this customer</Link>
      </p>

      <div className="afs-card" style={{ marginBottom: 20, maxWidth: 260 }}>
        <div style={{ fontSize: 12, color: "#667", marginBottom: 6 }}>Current Due</div>
        <div style={{ fontSize: 24, fontWeight: 700, color: currentDue > 0 ? "var(--afs-maroon)" : "#14532d" }}>
          Rs. {currentDue.toFixed(2)}
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
                <th>Debit</th>
                <th>Credit</th>
                <th>Balance</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => (
                <tr key={e.id}>
                  <td>{new Date(e.entryDate).toLocaleDateString("en-IN")}</td>
                  <td>{e.refType}</td>
                  <td>{e.invoice ? <Link href={`/invoices/${e.invoiceId}`}>{e.description}</Link> : e.description}</td>
                  <td>{Number(e.debit) > 0 ? Number(e.debit).toFixed(2) : "—"}</td>
                  <td>{Number(e.credit) > 0 ? Number(e.credit).toFixed(2) : "—"}</td>
                  <td>{Number(e.runningBalance).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
