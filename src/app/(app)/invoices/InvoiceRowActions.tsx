import { DownloadIcon, ViewIcon } from "@/components/icons";

export default function InvoiceRowActions({ invoiceId }: { invoiceId: string }) {
  return (
    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
      <a href={`/invoices/${invoiceId}`} className="afs-icon-btn" title="View invoice">
        <ViewIcon />
      </a>
      <a
        href={`/api/invoices/${invoiceId}/pdf`}
        target="_blank"
        rel="noopener noreferrer"
        className="afs-icon-btn"
        title="Download PDF"
      >
        <DownloadIcon />
      </a>
    </div>
  );
}
