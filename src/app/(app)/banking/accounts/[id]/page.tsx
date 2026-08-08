import { notFound, redirect } from "next/navigation";
import { getServerSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/permissions";
import NewTransactionForm from "./NewTransactionForm";
import TransactionRow from "./TransactionRow";

export default async function BankAccountPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession();
  if (!(await can(session!.tenantId, session!.roleId, "banking", "view"))) redirect("/dashboard");
  const { id } = await params;

  const account = await prisma.bankAccount.findFirst({ where: { id, tenantId: session!.tenantId } });
  if (!account) notFound();

  const [transactions, unmatchedPayments, unmatchedVendorPayments] = await Promise.all([
    prisma.bankTransaction.findMany({
      where: { bankAccountId: id },
      orderBy: { date: "desc" },
      include: {
        matchedPayment: { include: { customer: { select: { name: true } } } },
        matchedVendorPayment: { include: { vendor: { select: { name: true } } } },
      },
    }),
    prisma.payment.findMany({
      where: { tenantId: session!.tenantId, status: "SUCCESS", bankTransaction: null },
      include: { customer: { select: { name: true } } },
      orderBy: { date: "desc" },
    }),
    prisma.vendorPayment.findMany({
      where: { tenantId: session!.tenantId, status: "SUCCESS", bankTransaction: null },
      include: { vendor: { select: { name: true } } },
      orderBy: { date: "desc" },
    }),
  ]);

  return (
    <div>
      <h1 className="afs-page-title">{account.bankName}</h1>
      <p className="afs-page-subtitle">
        A/C {account.accountNo} · IFSC {account.ifsc}
        {account.branchName ? ` · ${account.branchName}` : ""}
      </p>

      <div className="afs-card" style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>Add a bank transaction</div>
        <NewTransactionForm bankAccountId={account.id} />
      </div>

      <div className="afs-card">
        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>
          Transactions <span style={{ fontWeight: 400, color: "#667" }}>(match each to a recorded payment for reconciliation)</span>
        </div>
        {transactions.length === 0 ? (
          <div className="afs-empty">No transactions yet.</div>
        ) : (
          <table className="afs-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Description</th>
                <th>Type</th>
                <th>Amount</th>
                <th>Match</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((t) => (
                <TransactionRow
                  key={t.id}
                  transaction={{
                    id: t.id,
                    date: t.date.toISOString(),
                    description: t.description,
                    amount: Number(t.amount),
                    type: t.type,
                    matchStatus: t.matchStatus,
                    matchedLabel: t.matchedPayment
                      ? `Payment from ${t.matchedPayment.customer.name} (Rs. ${Number(t.matchedPayment.amount).toFixed(2)})`
                      : t.matchedVendorPayment
                        ? `Payment to ${t.matchedVendorPayment.vendor.name} (Rs. ${Number(t.matchedVendorPayment.amount).toFixed(2)})`
                        : null,
                  }}
                  unmatchedPayments={unmatchedPayments.map((p) => ({
                    id: p.id,
                    label: `Customer: ${p.customer.name} - Rs. ${Number(p.amount).toFixed(2)} (${p.mode})`,
                  }))}
                  unmatchedVendorPayments={unmatchedVendorPayments.map((p) => ({
                    id: p.id,
                    label: `Vendor: ${p.vendor.name} - Rs. ${Number(p.amount).toFixed(2)} (${p.mode})`,
                  }))}
                />
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
