import Link from "next/link";
import { getServerSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { round2 } from "@/lib/gst-invoice";

type Bucket = "0-30" | "31-60" | "61-90" | "90+";

function bucketFor(days: number): Bucket {
  if (days <= 30) return "0-30";
  if (days <= 60) return "31-60";
  if (days <= 90) return "61-90";
  return "90+";
}

export default async function AgeingReportPage() {
  const session = await getServerSession();

  const invoices = await prisma.invoice.findMany({
    where: {
      tenantId: session!.tenantId,
      type: "SALE",
      status: { in: ["SENT", "PARTIALLY_PAID", "OVERDUE"] },
      archivedAt: null,
    },
    include: { customer: { select: { name: true } }, payments: { where: { status: "SUCCESS" } } },
    orderBy: { date: "asc" },
  });

  const now = Date.now();
  const buckets: Record<Bucket, number> = { "0-30": 0, "31-60": 0, "61-90": 0, "90+": 0 };

  const rows = invoices
    .map((inv) => {
      const paid = round2(inv.payments.reduce((sum, p) => sum + Number(p.amount), 0));
      const due = round2(Number(inv.total) - paid);
      const days = Math.floor((now - new Date(inv.date).getTime()) / (1000 * 60 * 60 * 24));
      return { inv, due, days, bucket: bucketFor(days) };
    })
    .filter((r) => r.due > 0);

  for (const r of rows) buckets[r.bucket] = round2(buckets[r.bucket] + r.due);
  const totalOutstanding = round2(rows.reduce((sum, r) => sum + r.due, 0));

  const bucketColors: Record<Bucket, string> = {
    "0-30": "#14532d",
    "31-60": "#92400e",
    "61-90": "#9a3412",
    "90+": "#7f1d1d",
  };

  return (
    <div>
      <h1 className="afs-page-title">Ageing Report</h1>
      <p className="afs-page-subtitle">Outstanding sale invoices, bucketed by days since invoice date</p>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 16, marginBottom: 20 }}>
        {(Object.keys(buckets) as Bucket[]).map((b) => (
          <div key={b} className="afs-card">
            <div style={{ fontSize: 12, color: "#667", marginBottom: 6 }}>{b} days</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: bucketColors[b] }}>Rs. {buckets[b].toFixed(2)}</div>
          </div>
        ))}
        <div className="afs-card" style={{ background: "var(--afs-navy)", color: "#fff" }}>
          <div style={{ fontSize: 12, opacity: 0.8, marginBottom: 6 }}>Total Outstanding</div>
          <div style={{ fontSize: 22, fontWeight: 700 }}>Rs. {totalOutstanding.toFixed(2)}</div>
        </div>
      </div>

      <div className="afs-card">
        {rows.length === 0 ? (
          <div className="afs-empty">Nothing outstanding.</div>
        ) : (
          <table className="afs-table">
            <thead>
              <tr>
                <th>Invoice</th>
                <th>Customer</th>
                <th>Date</th>
                <th>Days outstanding</th>
                <th>Bucket</th>
                <th>Due</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.inv.id}>
                  <td>
                    <Link href={`/invoices/${r.inv.id}`}>{r.inv.number}</Link>
                  </td>
                  <td>{r.inv.customer.name}</td>
                  <td>{new Date(r.inv.date).toLocaleDateString("en-IN")}</td>
                  <td>{r.days}</td>
                  <td>
                    <span className="afs-badge" style={{ background: "#f3f4f6", color: bucketColors[r.bucket] }}>
                      {r.bucket}
                    </span>
                  </td>
                  <td>Rs. {r.due.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
