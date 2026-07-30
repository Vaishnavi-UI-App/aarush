import { Prisma, Tenant } from "@/generated/prisma/client";
import { stateName } from "@/lib/state-codes";

type PurchaseWithRelations = Prisma.PurchaseGetPayload<{
  include: { lines: true; vendor: true };
}>;

function formatDate(d: Date): string {
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }).replace(/ /g, "/");
}

export interface PurchaseBillViewData {
  number: string;
  vendorBillNumber: string | null;
  date: string;
  dueDate: string | null;
  status: string;

  buyer: { name: string; address: string; gstin: string; stateCode: string; logoUrl: string };
  vendor: { name: string; address: string; gstin: string; stateCode: string; state: string };

  items: {
    srNo: number;
    description: string;
    hsnCode: string;
    qty: number;
    rate: number;
    taxableValue: number;
    cgstRate: number;
    cgstAmount: number;
    sgstRate: number;
    sgstAmount: number;
    igstRate: number;
    igstAmount: number;
    total: number;
  }[];

  subtotal: number;
  discount: number;
  totalCgst: number;
  totalSgst: number;
  totalIgst: number;
  grandTotal: number;
}

export function toPurchaseTemplateData(purchase: PurchaseWithRelations, tenant: Tenant): PurchaseBillViewData {
  return {
    number: purchase.number,
    vendorBillNumber: purchase.vendorBillNumber,
    date: formatDate(new Date(purchase.date)),
    dueDate: purchase.dueDate ? formatDate(new Date(purchase.dueDate)) : null,
    status: purchase.status,

    buyer: {
      name: tenant.name,
      address: tenant.addressLine ?? "",
      gstin: tenant.gstin,
      stateCode: tenant.stateCode,
      logoUrl: tenant.logoUrl ?? "/logo.jpeg",
    },

    vendor: {
      name: purchase.vendor.name,
      address: purchase.vendor.address ?? "",
      gstin: purchase.vendor.gstin ?? "",
      stateCode: purchase.vendor.stateCode,
      state: stateName(purchase.vendor.stateCode),
    },

    items: purchase.lines.map((line, i) => {
      const taxRate = Number(line.taxRate);
      const cgstAmount = Number(line.cgstAmount);
      const sgstAmount = Number(line.sgstAmount);
      const igstAmount = Number(line.igstAmount);
      return {
        srNo: i + 1,
        description: line.description,
        hsnCode: line.hsnCode,
        qty: Number(line.qty),
        rate: Number(line.rate),
        taxableValue: Number(line.taxableValue),
        cgstRate: cgstAmount > 0 ? taxRate / 2 : 0,
        cgstAmount,
        sgstRate: sgstAmount > 0 ? taxRate / 2 : 0,
        sgstAmount,
        igstRate: igstAmount > 0 ? taxRate : 0,
        igstAmount,
        total: Number(line.lineTotal),
      };
    }),

    subtotal: Number(purchase.subtotal),
    discount: Number(purchase.discount),
    totalCgst: Number(purchase.cgst),
    totalSgst: Number(purchase.sgst),
    totalIgst: Number(purchase.igst),
    grandTotal: Number(purchase.total),
  };
}
