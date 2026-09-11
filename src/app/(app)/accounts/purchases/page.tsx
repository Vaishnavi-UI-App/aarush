import { redirect } from "next/navigation";
import { getServerSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { round2 } from "@/lib/gst-invoice";
import { can } from "@/lib/permissions";
import ReportDashboard, { ReportConfig } from "../ReportDashboard";
import "../accounts.css";

const CONFIG: ReportConfig = {
  title: "Purchases",
  subtitle: "Purchases by month and by vendor, with what's been paid against each",
  partyLabel: "Vendor",
  partyHrefBase: "/vendors",
  partyFilterAllLabel: "All vendors",
  docLabel: "Bill",
  docHrefBase: "/purchases",
  amountLabel: "Purchases",
  settledLabel: "Paid",
  outstandingLabel: "Payable",
  outstandingHint: "still to pay",
  fileStem: "purchases",
  emptyLabel: "No purchases in this period.",
  countNoun: "Bills",
};

export default async function PurchasesReportPage() {
  const session = await getServerSession();
  if (!(await can(session!.tenantId, session!.roleId, "accounts", "view"))) redirect("/dashboard");

  // Mirrors the sales report: a cancelled bill was never a real cost, a draft isn't
  // one yet, and an archived (deleted) one has been taken off the books.
  const purchases = await prisma.purchase.findMany({
    where: {
      tenantId: session!.tenantId,
      status: { notIn: ["CANCELLED", "DRAFT"] },
      archivedAt: null,
    },
    include: {
      vendor: { select: { id: true, name: true } },
      vendorPayments: { where: { status: "SUCCESS" }, select: { amount: true } },
    },
    orderBy: { date: "desc" },
  });

  const rows = purchases.map((p) => {
    const total = Number(p.total);
    const settled = round2(p.vendorPayments.reduce((sum, vp) => sum + Number(vp.amount), 0));
    return {
      id: p.id,
      number: p.number,
      date: p.date.toISOString(),
      partyId: p.vendor.id,
      partyName: p.vendor.name,
      status: p.status,
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
