import { DownloadIcon, ViewIcon } from "@/components/icons";

export default function PurchaseRowActions({ purchaseId }: { purchaseId: string }) {
  return (
    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
      <a href={`/purchases/${purchaseId}`} className="afs-icon-btn" title="View purchase bill">
        <ViewIcon />
      </a>
      <a
        href={`/api/purchases/${purchaseId}/pdf`}
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
