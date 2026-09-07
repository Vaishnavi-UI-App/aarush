import { notFound } from "next/navigation";
import Link from "next/link";
import { getServerSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/permissions";
import { groupLedgerRows } from "@/lib/customer-ledger-rows";
import CustomerLedgerTable from "./CustomerLedgerTable";

export default async function CustomerLedgerPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession();
  const { id } = await params;

  const customer = await prisma.customer.findFirst({ where: { id, tenantId: session!.tenantId } });
  if (!customer) notFound();

  const entries = await prisma.ledgerEntry.findMany({
    where: { tenantId: session!.tenantId, customerId: id },
    include: { invoice: { select: { number: true } }, payment: { select: { batchId: true } } },
    orderBy: { createdAt: "asc" },
  });

  const currentDue = entries.length > 0 ? Number(entries[entries.length - 1].runningBalance) : 0;
  const canDelete = await can(session!.tenantId, session!.roleId, "customers", "delete");

  const batchIdByPaymentId = new Map(entries.filter((e) => e.paymentId).map((e) => [e.paymentId!, e.payment?.batchId ?? null]));
  const rows = groupLedgerRows(
    entries.map((e) => ({
      id: e.id,
      entryDate: e.entryDate.toISOString(),
      refType: e.refType,
      description: e.description,
      invoiceId: e.invoiceId,
      paymentId: e.paymentId,
      debit: Number(e.debit),
      credit: Number(e.credit),
      runningBalance: Number(e.runningBalance),
    })),
    batchIdByPaymentId
  );

  return (
    <div>
      <div className="afs-page-header">
        <div>
          <h1 className="afs-page-title">{customer.name}</h1>
          <p className="afs-page-subtitle">
            {customer.gstin ?? "No GSTIN"} · State {customer.stateCode} ·{" "}
            <Link href={`/invoices/new?customerId=${customer.id}`}>+ New invoice for this customer</Link>
          </p>
        </div>
        <div className="afs-page-header-actions">
          <a href={`/api/customers/${customer.id}/statement/export`} className="afs-btn" style={{ background: "#e5e7eb", color: "#333" }}>
            ⬇ Excel (CSV)
          </a>
          <a
            href={`/api/customers/${customer.id}/statement/pdf`}
            target="_blank"
            rel="noopener noreferrer"
            className="afs-btn afs-btn-primary"
          >
            ⬇ PDF Statement
          </a>
        </div>
      </div>

      <div className="afs-card" style={{ marginBottom: 20, maxWidth: 260 }}>
        <div style={{ fontSize: 12, color: "#667", marginBottom: 6 }}>
          {currentDue > 0 ? "Current Due" : currentDue < 0 ? "Advance Balance" : "Current Due"}
        </div>
        <div style={{ fontSize: 24, fontWeight: 700, color: currentDue > 0 ? "var(--afs-maroon)" : "#14532d" }}>
          Rs. {Math.abs(currentDue).toFixed(2)}
        </div>
      </div>

      <div className="afs-card">
        {entries.length === 0 ? (
          <div className="afs-empty">No transactions yet.</div>
        ) : (
          <>
            <p style={{ fontSize: 12, color: "#667", marginBottom: 10 }}>
              Balance is the running total after each row: a positive amount is still <strong>due</strong> from the customer, a
              negative amount is <strong>advance</strong> held on their behalf. Every payment row starts collapsed --
              click one to see which invoice(s) it was applied against.
            </p>
            <CustomerLedgerTable customerId={customer.id} rows={rows} canDelete={canDelete} />
          </>
        )}
      </div>
    </div>
  );
}
