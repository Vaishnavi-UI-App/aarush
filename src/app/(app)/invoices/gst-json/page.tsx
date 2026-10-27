import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/permissions";

/** Turns MMYYYY into something readable, e.g. "102026" -> "October 2026". */
function periodLabel(period: string): string {
  const m = Number(period.slice(0, 2));
  const y = period.slice(2);
  const name = new Date(2000, m - 1, 1).toLocaleDateString("en-IN", { month: "long" });
  return `${name} ${y}`;
}

export default async function GstJsonFilesPage() {
  const session = await getServerSession();
  if (!(await can(session!.tenantId, session!.roleId, "invoices", "view"))) redirect("/dashboard");

  const files = await prisma.gstJsonExport.findMany({
    where: { tenantId: session!.tenantId },
    include: {
      createdBy: { select: { name: true, email: true } },
      invoices: { select: { id: true, number: true }, orderBy: { number: "asc" } },
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div>
      <div className="afs-page-header">
        <div>
          <h1 className="afs-page-title">GST JSON files</h1>
          <p className="afs-page-subtitle">
            Every return file created from this system. Anyone here can download them — whoever files the return
            doesn&apos;t have to be whoever made the file.
          </p>
        </div>
        <div className="afs-page-header-actions">
          <Link href="/invoices" className="afs-btn">
            ← Back to Invoices
          </Link>
        </div>
      </div>

      <div className="afs-card" style={{ marginTop: 20 }}>
        {files.length === 0 ? (
          <div className="afs-empty">
            No JSON files yet. Tick some bills on the Invoices page and press Create GST JSON.
          </div>
        ) : (
          <table className="afs-table">
            <thead>
              <tr>
                <th>File</th>
                <th>Period</th>
                <th>Bills</th>
                <th>Size</th>
                <th>Created by</th>
                <th>Created</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {files.map((f) => (
                <tr key={f.id}>
                  <td data-label="File">
                    <span className="gstjson-file">{f.fileName}</span>
                    <div className="gstjson-bills">
                      {f.invoices.map((i, n) => (
                        <span key={i.id}>
                          {n > 0 && ", "}
                          <Link href={`/invoices/${i.id}`}>{i.number}</Link>
                        </span>
                      ))}
                    </div>
                  </td>
                  <td data-label="Period">{periodLabel(f.period)}</td>
                  <td data-label="Bills">{f.invoiceCount}</td>
                  <td data-label="Size">{(f.byteSize / 1024).toFixed(0)} KB</td>
                  <td data-label="Created by">{f.createdBy?.name || f.createdBy?.email || "—"}</td>
                  <td data-label="Created">{new Date(f.createdAt).toLocaleString("en-IN")}</td>
                  <td>
                    <a className="afs-btn afs-btn-gold" href={`/api/reports/gst-json/${f.id}`} download>
                      ⬇ Download
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
