import InvoiceTemplate from "@/components/InvoiceTemplate";
import InvoiceActions from "@/components/InvoiceActions";
import { sampleInvoice } from "@/lib/invoice-data";
import "@/components/invoice.css";
import "./invoice-page.css";

export default function InvoiceViewPage() {
  return (
    <div className="afs-page-bg">
      <header className="afs-header">
        <img src={sampleInvoice.seller.logoUrl} alt={`${sampleInvoice.seller.name} logo`} />
        <div className="afs-header-text">
          <span className="afs-header-title">{sampleInvoice.seller.name}</span>
          <span className="afs-header-subtitle">Tax Invoice {sampleInvoice.invoiceNumber}</span>
        </div>
      </header>

      <InvoiceActions
        defaultEmail={sampleInvoice.billedTo.email}
        defaultPhone={sampleInvoice.billedTo.mobile ? `91${sampleInvoice.billedTo.mobile}` : undefined}
      />

      <div className="afs-invoice-card">
        <InvoiceTemplate invoice={sampleInvoice} />
      </div>
    </div>
  );
}
