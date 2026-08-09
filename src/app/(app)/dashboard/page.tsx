import Link from "next/link";
import { getServerSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { round2 } from "@/lib/gst-invoice";
import { marksOwnAttendance } from "@/lib/permissions";
import { attendanceDateBucket, reconcileStaleOpenDays } from "@/lib/attendance";
import RevenueTrendChart from "./RevenueTrendChart";
import InvoiceStatusChart from "./InvoiceStatusChart";
import ThemeShell from "./ThemeShell";
import StaffDashboard from "./StaffDashboard";
import { ReceivableIcon, InvoiceIcon, CustomersIcon, OverdueIcon } from "@/components/icons";
import "./dashboard.css";

function badgeClass(status: string) {
  return `dd-badge dd-badge-${status.toLowerCase()}`;
}

function monthLabel(date: Date): string {
  return date.toLocaleDateString("en-IN", { month: "short" });
}

export default async function DashboardPage() {
  const session = await getServerSession();
  const tenantId = session!.tenantId;
  const userId = session!.userId;

  // Owners get the financial overview below; everyone else (field/office staff who
  // punch their own attendance) gets a personal dashboard instead -- they generally
  // shouldn't be the audience for company-wide revenue/receivables anyway.
  if (await marksOwnAttendance(tenantId, session!.roleId)) {
    await reconcileStaleOpenDays(tenantId, userId);

    const monthStart = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1));

    const [user, today, monthRecords] = await Promise.all([
      prisma.user.findUniqueOrThrow({
        where: { id: userId },
        select: { name: true, email: true, photoData: true, role: true, roleRef: { select: { name: true } } },
      }),
      prisma.attendanceRecord.findUnique({
        where: { tenantId_userId_date: { tenantId, userId, date: attendanceDateBucket() } },
        include: { punches: { orderBy: { at: "asc" } }, breaks: { orderBy: { startAt: "asc" } } },
      }),
      prisma.attendanceRecord.findMany({
        where: { tenantId, userId, date: { gte: monthStart } },
      }),
    ]);

    const presentDays = monthRecords.filter((r) => r.status === "PRESENT").length;
    const halfDays = monthRecords.filter((r) => r.status === "HALF_DAY").length;
    const absentDays = monthRecords.filter((r) => r.status === "ABSENT").length;
    const lateCount = monthRecords.filter((r) => r.isLate).length;
    const totalHoursThisMonth = monthRecords.reduce((sum, r) => sum + Number(r.computedWorkHours ?? 0), 0);

    return (
      <StaffDashboard
        user={{
          name: user.name,
          email: user.email,
          photoData: user.photoData,
          roleName: user.roleRef?.name ?? user.role.replace("_", " "),
        }}
        today={
          today
            ? {
                status: today.status,
                punches: today.punches.map((p) => ({ kind: p.kind, at: p.at.toISOString() })),
                breaks: today.breaks.map((b) => ({ startAt: b.startAt.toISOString(), endAt: b.endAt ? b.endAt.toISOString() : null })),
              }
            : null
        }
        monthStats={{ presentDays, halfDays, absentDays, lateCount, totalHours: round2(totalHoursThisMonth) }}
      />
    );
  }

  const [invoices, customers] = await Promise.all([
    prisma.invoice.findMany({
      where: { tenantId, type: "SALE", archivedAt: null },
      include: { customer: { select: { name: true } } },
      orderBy: { date: "desc" },
    }),
    prisma.customer.count({ where: { tenantId } }),
  ]);

  const totalReceivable = invoices
    .filter((i) => i.status !== "PAID" && i.status !== "CANCELLED")
    .reduce((sum, i) => sum + Number(i.total), 0);
  const totalInvoiced = invoices.reduce((sum, i) => sum + Number(i.total), 0);
  const overdueCount = invoices.filter((i) => i.status === "OVERDUE").length;

  const stats = [
    { label: "Total Receivable", value: `Rs. ${totalReceivable.toFixed(2)}`, Icon: ReceivableIcon },
    { label: "Total Invoiced (all-time)", value: `Rs. ${totalInvoiced.toFixed(2)}`, Icon: InvoiceIcon },
    { label: "Customers", value: customers.toString(), Icon: CustomersIcon },
    { label: "Overdue Invoices", value: overdueCount.toString(), Icon: OverdueIcon },
  ];

  // Last 6 calendar months, oldest first.
  const now = new Date();
  const months = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
    return { year: d.getFullYear(), month: d.getMonth(), label: monthLabel(d) };
  });
  const revenueByMonth = months.map((m) => {
    const total = invoices
      .filter((inv) => {
        const d = new Date(inv.date);
        return d.getFullYear() === m.year && d.getMonth() === m.month;
      })
      .reduce((sum, inv) => sum + Number(inv.total), 0);
    return { label: m.label, value: round2(total) };
  });

  const statusOrder = ["DRAFT", "SENT", "PARTIALLY_PAID", "PAID", "OVERDUE"];
  const statusCounts = statusOrder.map((status) => ({
    status,
    count: invoices.filter((i) => i.status === status).length,
  }));

  const recentInvoices = invoices.slice(0, 5);

  return (
    <ThemeShell>
      <div className="dd-stat-grid">
        {stats.map((s) => (
          <div key={s.label} className="dd-card dd-stat-card">
            <div>
              <div className="dd-stat-label">{s.label}</div>
              <div className="dd-stat-value">{s.value}</div>
            </div>
            <div className="dd-stat-icon">
              <s.Icon />
            </div>
          </div>
        ))}
      </div>

      <div className="dd-panels">
        <div className="dd-card">
          <div className="dd-panel-title">Monthly Revenue Trend</div>
          <RevenueTrendChart data={revenueByMonth} />
        </div>
        <div className="dd-card">
          <div className="dd-panel-title">Invoice Status Overview</div>
          <InvoiceStatusChart data={statusCounts} />
        </div>
      </div>

      <div className="dd-card">
        <div className="dd-panel-title">Recent Invoices</div>
        {recentInvoices.length === 0 ? (
          <div className="dd-empty">No invoices yet.</div>
        ) : (
          <table className="dd-table">
            <thead>
              <tr>
                <th>Invoice #</th>
                <th>Customer Name</th>
                <th>Date</th>
                <th>Total Amount</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {recentInvoices.map((inv) => (
                <tr key={inv.id}>
                  <td data-label="Invoice #">{inv.number}</td>
                  <td data-label="Customer Name">{inv.customer.name}</td>
                  <td data-label="Date">{new Date(inv.date).toLocaleDateString("en-IN")}</td>
                  <td data-label="Total Amount">Rs. {Number(inv.total).toFixed(2)}</td>
                  <td data-label="Status">
                    <span className={badgeClass(inv.status)}>{inv.status.replace("_", " ")}</span>
                  </td>
                  <td>
                    <Link href={`/invoices/${inv.id}`} className="dd-view-link">
                      View →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </ThemeShell>
  );
}
