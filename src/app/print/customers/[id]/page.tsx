import { notFound } from "next/navigation";
import { getServerSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import "@/components/expense-report.css";

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
    }),
  ]);

  if (!customer) notFound();

  const currentBalance = entries.length > 0 ? Number(entries[entries.length - 1].runningBalance) : 0;
  const currentDue = currentBalance > 0 ? currentBalance : 0;
  const advanceBalance = currentBalance < 0 ? -currentBalance : 0;
  const totalBilled = entries.reduce((sum, e) => sum + Number(e.debit), 0);
  const totalPaid = entries.reduce((sum, e) => sum + Number(e.credit), 0);

  return (
    <div className="report-page">
      <div className="report-title">{tenant.name}</div>
      <div className="report-subtitle">
        Customer Statement for {customer.name} -- Generated {new Date().toLocaleDateString("en-IN")}
      </div>

      <table className="report-table" style={{ marginBottom: 16 }}>
        <tbody>
          <tr>
            <td>
              <b>Customer</b>
              <br />
              {customer.name}
              <br />
              {customer.gstin && (
                <>
                  GSTIN: {customer.gstin}
                  <br />
                </>
              )}
              {customer.address}
            </td>
            <td className="right">
              <b>Total Billed</b>: Rs. {totalBilled.toFixed(2)}
              <br />
              <b>Total Paid</b>: Rs. {totalPaid.toFixed(2)}
              <br />
              <b>Current Due</b>: Rs. {currentDue.toFixed(2)}
              <br />
              <b>Advance Balance</b>: Rs. {advanceBalance.toFixed(2)}
            </td>
          </tr>
        </tbody>
      </table>

      <table className="report-table">
        <thead>
          <tr>
            <th>Date</th>
            <th>Type</th>
            <th>Description</th>
            <th className="right">Debit</th>
            <th className="right">Credit</th>
            <th className="right">Balance</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((e) => (
            <tr key={e.id}>
              <td>{new Date(e.entryDate).toLocaleDateString("en-IN")}</td>
              <td>{e.refType}</td>
              <td>{e.description}</td>
              <td className="right">{Number(e.debit) > 0 ? Number(e.debit).toFixed(2) : "—"}</td>
              <td className="right">{Number(e.credit) > 0 ? Number(e.credit).toFixed(2) : "—"}</td>
              <td className="right">{Number(e.runningBalance).toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td colSpan={3} className="right">
              Closing Balance
            </td>
            <td className="right">{totalBilled.toFixed(2)}</td>
            <td className="right">{totalPaid.toFixed(2)}</td>
            <td className="right">{currentBalance.toFixed(2)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
