import { redirect } from "next/navigation";
import { getServerSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { round2 } from "@/lib/gst-invoice";
import { can } from "@/lib/permissions";
import AccountsDashboard from "./AccountsDashboard";
import "./accounts.css";

export default async function AccountsPage() {
  const session = await getServerSession();
  if (!(await can(session!.tenantId, session!.roleId, "accounts", "view"))) redirect("/dashboard");

  // Every sale that counts as revenue: proformas and quotations are not sales, a
  // cancelled invoice never was one, and an archived (deleted) one has been taken
  // off the books -- the same set the ledger and ageing report work from.
  const invoices = await prisma.invoice.findMany({
    where: {
      tenantId: session!.tenantId,
      type: "SALE",
      status: { not: "CANCELLED" },
      archivedAt: null,
    },
    include: {
      customer: { select: { id: true, name: true } },
      payments: { where: { status: "SUCCESS" }, select: { amount: true } },
    },
    orderBy: { date: "desc" },
  });

  const sales = invoices.map((inv) => {
    const total = Number(inv.total);
    const received = round2(inv.payments.reduce((sum, p) => sum + Number(p.amount), 0));
    return {
      id: inv.id,
      number: inv.number,
      date: inv.date.toISOString(),
      customerId: inv.customer.id,
      customerName: inv.customer.name,
      status: inv.status,
      total,
      received,
      outstanding: round2(Math.max(total - received, 0)),
    };
  });

  const customers = [...new Map(sales.map((s) => [s.customerId, s.customerName])).entries()]
    .map(([id, name]) => ({ id, name }))
    .sort((a, b) => a.name.localeCompare(b.name));

  return <AccountsDashboard sales={sales} customers={customers} />;
}
