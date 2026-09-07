import { redirect } from "next/navigation";
import { getServerSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { round2 } from "@/lib/gst-invoice";
import { can } from "@/lib/permissions";
import BankingDashboard from "./BankingDashboard";
import "./banking.css";

export default async function BankingPage() {
  const session = await getServerSession();
  if (!(await can(session!.tenantId, session!.roleId, "banking", "view"))) redirect("/dashboard");
  const tenantId = session!.tenantId;
  const canDeletePayments = await can(session!.tenantId, session!.roleId, "customers", "delete");

  const customers = await prisma.customer.findMany({
    where: { tenantId },
    orderBy: { name: "asc" },
    include: {
      invoices: {
        // archivedAt filter matters: a deleted invoice must not count toward billed
        // or due here, the same way the dashboard and ageing report already exclude it.
        where: { type: "SALE", status: { not: "CANCELLED" }, archivedAt: null },
        include: { payments: { where: { status: "SUCCESS" } } },
        // Oldest first, so the payment modal's auto-apply cascade always settles the
        // longest-outstanding bill before a newer one.
        orderBy: { date: "asc" },
      },
      // All SUCCESS payments, not just ones tied to an invoice -- a general/unapplied
      // payment (invoiceId null) is how an advance gets recorded, and it must still
      // count toward "paid" or it vanishes from both Due and Advance below.
      payments: { where: { status: "SUCCESS" } },
    },
  });

  const rows = customers.map((c) => {
    const billed = round2(c.invoices.reduce((sum, inv) => sum + Number(inv.total), 0));
    const paid = round2(c.payments.reduce((sum, p) => sum + Number(p.amount), 0));
    const net = round2(billed - paid);
    const due = net > 0 ? net : 0;
    const advance = net < 0 ? round2(-net) : 0;

    const unpaidInvoices = c.invoices
      .filter((inv) => inv.status !== "PAID")
      .map((inv) => {
        const invPaid = round2(inv.payments.reduce((s, p) => s + Number(p.amount), 0));
        return { id: inv.id, number: inv.number, total: Number(inv.total), paid: invPaid, due: round2(Number(inv.total) - invPaid) };
      });

    // Most recent invoice or payment for this customer -- a single "when did we last
    // do business with them" date for the summary row (the table has no room for a
    // whole transaction history; that's what the customer's own ledger page is for).
    const activityDates = [...c.invoices.map((inv) => inv.date), ...c.payments.map((p) => p.date)];
    const lastActivity =
      activityDates.length > 0 ? new Date(Math.max(...activityDates.map((d) => d.getTime()))).toISOString() : null;

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
      lastActivity,
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

  return <BankingDashboard rows={rows} totals={totals} canDeletePayments={canDeletePayments} />;
}
