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

export default async function PrintAllCustomersStatementPage() {
  const session = await getServerSession();
  if (!session) notFound();

  const [tenant, customers] = await Promise.all([
    prisma.tenant.findUniqueOrThrow({ where: { id: session.tenantId } }),
    prisma.customer.findMany({
      where: { tenantId: session.tenantId, archivedAt: null },
      orderBy: { name: "asc" },
      include: {
        ledgerEntries: {
          orderBy: { createdAt: "asc" },
          include: { invoice: { select: { number: true } }, payment: { select: { mode: true, referenceNo: true } } },
        },
      },
    }),
  ]);

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
      <div className="report-subtitle" style={{ fontWeight: "bold", fontSize: 14 }}>
        All Customers -- Ledger Accounts
      </div>

      {customers.map((customer, idx) => {
        const rows = buildTallyLedgerRows(
          customer.ledgerEntries.map((e) => ({
            entryDate: e.entryDate,
            refType: e.refType,
            debit: Number(e.debit),
            credit: Number(e.credit),
            invoiceNumber: e.invoice?.number,
            paymentMode: e.payment?.mode,
            paymentReferenceNo: e.payment?.referenceNo,
          }))
        );
        if (rows.length === 0) return null;
        const totalDebit = rows.reduce((s, r) => s + r.debit, 0);
        const totalCredit = rows.reduce((s, r) => s + r.credit, 0);
        const plug = closingBalancePlug(rows);
        const grandTotal = Math.max(totalDebit, totalCredit) + plug.amount;
        const periodStart = rows[0].date;

        return (
          <div key={customer.id} style={{ pageBreakBefore: idx === 0 ? "auto" : "always", marginTop: idx === 0 ? 16 : 0 }}>
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
      })}
    </div>
  );
}
