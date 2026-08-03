import { redirect } from "next/navigation";
import { getServerSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { round2 } from "@/lib/gst-invoice";
import { canAccessFinance } from "@/lib/permissions";
import BankingDashboard from "./BankingDashboard";
import "./banking.css";

export default async function BankingPage() {
  const session = await getServerSession();
  if (!(await canAccessFinance(session!.tenantId, session!.role))) redirect("/dashboard");
  const tenantId = session!.tenantId;

  const customers = await prisma.customer.findMany({
    where: { tenantId },
    orderBy: { name: "asc" },
    include: {
      invoices: {
        where: { type: "SALE", status: { not: "CANCELLED" } },
        include: { payments: { where: { status: "SUCCESS" } } },
      },
    },
  });

  const rows = customers.map((c) => {
    const billed = round2(c.invoices.reduce((sum, inv) => sum + Number(inv.total), 0));
    const paid = round2(
      c.invoices.reduce((sum, inv) => sum + inv.payments.reduce((s, p) => s + Number(p.amount), 0), 0)
    );
    const net = round2(billed - paid);
    const due = net > 0 ? net : 0;
    const advance = net < 0 ? round2(-net) : 0;

    const unpaidInvoices = c.invoices
      .filter((inv) => inv.status !== "PAID")
      .map((inv) => {
        const invPaid = round2(inv.payments.reduce((s, p) => s + Number(p.amount), 0));
        return { id: inv.id, number: inv.number, due: round2(Number(inv.total) - invPaid) };
      });

    return {
      id: c.id,
      name: c.name,
      phone: c.phone,
      email: c.email,
      billed,
      paid,
      due,
      advance,
      unpaidInvoices,
    };
  });

  const totals = rows.reduce(
    (acc, r) => ({
      billed: round2(acc.billed + r.billed),
      paid: round2(acc.paid + r.paid),
      due: round2(acc.due + r.due),
      advance: round2(acc.advance + r.advance),
    }),
    { billed: 0, paid: 0, due: 0, advance: 0 }
  );

  return <BankingDashboard rows={rows} totals={totals} />;
}
