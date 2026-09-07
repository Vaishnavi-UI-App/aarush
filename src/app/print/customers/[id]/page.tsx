import { notFound } from "next/navigation";
import { getServerSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { buildTallyLedgerRows, closingBalancePlug } from "@/lib/customer-ledger-report";
import "@/components/expense-report.css";

function money(n: number): string {
  return n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtDate(d: Date): string {
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "2-digit" }).replace(/ /g, "-");
}

export default async function PrintCustomerStatementPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession();
  if (!session) notFound();

  const { id: customerId } = await params;

  const [tenant, customer, entries] = await Promise.all([
    prisma.tenant.findUniqueOrThrow({ where: { id: session.tenantId } }),
    prisma.customer.findFirst({ where: { id: customerId, tenantId: session.tenantId } }),
    prisma.ledgerEntry.findMany({
      where: { tenantId: session.tenantId, customerId },
      orderBy: { createdAt: "asc" },
      include: { invoice: { select: { number: true } }, payment: { select: { mode: true, referenceNo: true, batchId: true } } },
    }),
  ]);

  if (!customer) notFound();

  const rows = buildTallyLedgerRows(
    entries.map((e) => ({
      entryDate: e.entryDate,
      refType: e.refType,
      debit: Number(e.debit),
      credit: Number(e.credit),
      invoiceNumber: e.invoice?.number,
      paymentMode: e.payment?.mode,
      paymentReferenceNo: e.payment?.referenceNo,
      paymentBatchId: e.payment?.batchId,
    }))
  );
  const totalDebit = rows.reduce((s, r) => s + r.debit, 0);
  const totalCredit = rows.reduce((s, r) => s + r.credit, 0);
  const plug = closingBalancePlug(rows);
  const grandTotal = Math.max(totalDebit, totalCredit) + plug.amount;

  const periodStart = rows.length > 0 ? rows[0].date : new Date();

  return (
    <div className="report-page">
      <div className="report-title">{tenant.name}</div>
      <div className="report-subtitle">
        {tenant.addressLine && <>{tenant.addressLine}</>}
        {tenant.cinNo && (
          <>
            <br />
            CIN: {tenant.cinNo}
          </>
        )}
        {tenant.phone && (
          <>
            <br />
            Contact: {tenant.phone}
          </>
        )}
        {tenant.email && (
          <>
            <br />
            E-Mail: {tenant.email}
          </>
        )}
      </div>

      <div className="report-title" style={{ fontSize: 15, marginTop: 8 }}>
        {customer.name}
      </div>
      <div className="report-subtitle">
        Ledger Account
        {customer.address && (
          <>
            <br />
            {customer.address}
          </>
        )}
        <br />
        {fmtDate(periodStart)} to {fmtDate(new Date())}
      </div>

      <table className="report-table">
        <thead>
          <tr>
            <th>Date</th>
            <th>Particulars</th>
            <th>Vch Type</th>
            <th>Vch No.</th>
            <th className="right">Debit</th>
            <th className="right">Credit</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              <td>{fmtDate(r.date)}</td>
              <td>{r.particulars}</td>
              <td>{r.vchType}</td>
              <td>{r.vchNo}</td>
              <td className="right">{r.debit > 0 ? money(r.debit) : ""}</td>
              <td className="right">{r.credit > 0 ? money(r.credit) : ""}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td colSpan={4} className="right">
              Total
            </td>
            <td className="right">{money(totalDebit)}</td>
            <td className="right">{money(totalCredit)}</td>
          </tr>
          <tr>
            <td colSpan={4} className="right">
              Closing Balance
            </td>
            <td className="right">{plug.side === "debit" ? money(plug.amount) : ""}</td>
            <td className="right">{plug.side === "credit" ? money(plug.amount) : ""}</td>
          </tr>
          <tr>
            <td colSpan={4} className="right">
              Grand Total
            </td>
            <td className="right">{money(grandTotal)}</td>
            <td className="right">{money(grandTotal)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
