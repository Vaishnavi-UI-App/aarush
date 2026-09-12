import { redirect } from "next/navigation";
import { getServerSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { round2 } from "@/lib/gst-invoice";
import { can } from "@/lib/permissions";
import ReportDashboard, { ReportConfig } from "../ReportDashboard";
import "../accounts.css";

const CONFIG: ReportConfig = {
  title: "Sales",
  subtitle: "Sales by month and by customer, with what's been received against each",
  partyLabel: "Customer",
  partyHrefBase: "/customers",
  partyFilterAllLabel: "All customers",
  docLabel: "Invoice",
  docHrefBase: "/invoices",
  amountLabel: "Sales",
  settledLabel: "Received",
  outstandingLabel: "Outstanding",
  outstandingHint: "still to collect",
  fileStem: "sales",
  emptyLabel: "No sales in this period.",
  countNoun: "Invoices",
  showGstr1Export: true,
};

export default async function SalesReportPage() {
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

  const rows = invoices.map((inv) => {
    const total = Number(inv.total);
    const settled = round2(inv.payments.reduce((sum, p) => sum + Number(p.amount), 0));
    return {
      id: inv.id,
      number: inv.number,
      date: inv.date.toISOString(),
      partyId: inv.customer.id,
      partyName: inv.customer.name,
      status: inv.status,
      total,
      settled,
      outstanding: round2(Math.max(total - settled, 0)),
    };
  });

  const parties = [...new Map(rows.map((r) => [r.partyId, r.partyName])).entries()]
    .map(([id, name]) => ({ id, name }))
    .sort((a, b) => a.name.localeCompare(b.name));

  return <ReportDashboard rows={rows} parties={parties} config={CONFIG} />;
}
