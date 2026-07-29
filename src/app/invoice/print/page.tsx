import InvoiceTemplate from "@/components/InvoiceTemplate";
import { sampleInvoice } from "@/lib/invoice-data";
import "@/components/invoice.css";

export default function InvoicePrintPage() {
  return <InvoiceTemplate invoice={sampleInvoice} />;
}
