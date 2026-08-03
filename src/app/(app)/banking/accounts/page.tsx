import { redirect } from "next/navigation";
import { getServerSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { canAccessFinance } from "@/lib/permissions";
import NewBankAccountForm from "./NewBankAccountForm";

export default async function BankingPage() {
  const session = await getServerSession();
  if (!(await canAccessFinance(session!.tenantId, session!.role))) redirect("/dashboard");
  const accounts = await prisma.bankAccount.findMany({
    where: { tenantId: session!.tenantId },
    orderBy: { createdAt: "asc" },
  });

  return (
    <div>
      <p style={{ marginBottom: 12 }}>
        <a href="/banking" style={{ fontSize: 13 }}>
          ← Back to Banking overview
        </a>
      </p>
      <h1 className="afs-page-title">Bank Accounts &amp; Reconciliation</h1>
      <p className="afs-page-subtitle">Bank accounts and reconciliation against recorded payments</p>

      <div className="afs-card" style={{ marginBottom: 20 }}>
        <NewBankAccountForm />
      </div>

      <div className="afs-card">
        {accounts.length === 0 ? (
          <div className="afs-empty">No bank accounts yet.</div>
        ) : (
          <table className="afs-table">
            <thead>
              <tr>
                <th>Bank</th>
                <th>Account No.</th>
                <th>IFSC</th>
                <th>Branch</th>
              </tr>
            </thead>
            <tbody>
              {accounts.map((a) => (
                <tr key={a.id}>
                  <td>
                    <a href={`/banking/accounts/${a.id}`}>{a.bankName}</a>
                  </td>
                  <td>{a.accountNo}</td>
                  <td>{a.ifsc}</td>
                  <td>{a.branchName ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
