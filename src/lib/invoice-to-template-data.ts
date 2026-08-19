import { Prisma, Tenant } from "@/generated/prisma/client";
import { InvoiceData, InvoiceLineItem } from "@/lib/invoice-types";
import { amountInWords } from "@/lib/number-to-words";
import { stateName } from "@/lib/state-codes";

type InvoiceWithRelations = Prisma.InvoiceGetPayload<{
  include: { lines: true; customer: true; site: true };
}>;

function formatDate(d: Date): string {
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }).replace(/ /g, "/");
}

/** Maps a real, persisted invoice + its owning tenant into the shape the
 * printable InvoiceTemplate expects -- the same template used for the sample
 * invoice, so every real invoice a tenant raises prints in that same layout. */
export function toInvoiceTemplateData(invoice: InvoiceWithRelations, tenant: Tenant): InvoiceData {
  const items: InvoiceLineItem[] = invoice.lines.map((line, i) => ({
    srNo: line.srNo ?? i + 1,
    name: line.description,
    description: line.detail ?? undefined,
    hsnSac: line.hsnCode,
    qty: Number(line.qty),
    unit: line.unit,
    rate: Number(line.rate),
    taxableValue: Number(line.taxableValue),
    cgstRate: Number(line.taxRate) > 0 && Number(line.cgstAmount) > 0 ? Number(line.taxRate) / 2 : 0,
    cgstAmount: Number(line.cgstAmount),
    sgstRate: Number(line.taxRate) > 0 && Number(line.sgstAmount) > 0 ? Number(line.taxRate) / 2 : 0,
    sgstAmount: Number(line.sgstAmount),
    igstRate: Number(line.igstAmount) > 0 ? Number(line.taxRate) : 0,
    igstAmount: Number(line.igstAmount),
    total: Number(line.lineTotal),
  }));

  const customer = invoice.customer;

  return {
    documentType: invoice.type === "PROFORMA" ? "PROFORMA" : invoice.type === "QUOTATION" ? "QUOTATION" : "SALE",
    isServiceInvoice: invoice.isServiceInvoice,
    invoiceNumber: invoice.number,
    invoiceDate: formatDate(new Date(invoice.date)),
    placeOfSupply: stateName(customer.stateCode),
    dateOfSupply: formatDate(new Date(invoice.date)),
    reverseCharge: invoice.reverseCharge ? "YES" : "NO",
    watermark: invoice.archivedAt || invoice.status === "CANCELLED" ? "CANCELLED" : undefined,
    poNumber: invoice.poNumber ?? undefined,
    poDate: invoice.poDate ? formatDate(new Date(invoice.poDate)) : undefined,
    vehicleNumber: invoice.vehicleNumber ?? undefined,
    transportationMode: invoice.transportationMode ?? undefined,
    deliveredThrough: invoice.deliveredThrough ?? undefined,
    placeOfSupplySite: invoice.placeOfSupplySite ?? undefined,
    site: invoice.site?.name ?? undefined,
    paymentTerms: invoice.paymentTerms ?? undefined,

    seller: {
      name: tenant.name,
      addressLines: tenant.addressLine ? [tenant.addressLine] : [],
      phone: tenant.phone ?? "",
      email: tenant.email ?? "",
      gstin: tenant.gstin,
      stateCode: tenant.stateCode,
      pan: tenant.pan ?? "",
      cinNo: tenant.cinNo ?? undefined,
      website: tenant.website ?? undefined,
      logoUrl: tenant.logoUrl ?? "/logo.jpeg",
    },

    billedTo: {
      name: customer.name,
      address: customer.address ?? "",
      mobile: customer.phone ?? undefined,
      email: customer.email ?? undefined,
      gstin: customer.gstin ?? "",
      stateCode: customer.stateCode,
      state: stateName(customer.stateCode),
    },

    shippedTo: invoice.shipToSameAsBilling
      ? {
          name: customer.name,
          address: customer.address ?? "",
          gstin: customer.gstin ?? "",
          stateCode: customer.stateCode,
          state: stateName(customer.stateCode),
        }
      : {
          name: invoice.shipToName ?? customer.name,
          address: invoice.shipToAddress ?? "",
          gstin: invoice.shipToGstin ?? "",
          stateCode: invoice.shipToStateCode ?? customer.stateCode,
          state: stateName(invoice.shipToStateCode ?? customer.stateCode),
        },

    items,

    taxableAmount: Number(invoice.subtotal),
    totalCgst: Number(invoice.cgst),
    totalSgst: Number(invoice.sgst),
    totalIgst: Number(invoice.igst),
    grandTotal: Number(invoice.total),
    amountInWords: amountInWords(Number(invoice.total)),

    bank: {
      accountName: tenant.bankAccountName ?? "",
      accountNo: tenant.bankAccountNo ?? "",
      ifsc: tenant.bankIfsc ?? "",
      bankName: tenant.bankName ?? "",
      branchName: tenant.bankBranch ?? "",
    },

    terms: tenant.invoiceTerms ? tenant.invoiceTerms.split("\n") : [],
  };
}
