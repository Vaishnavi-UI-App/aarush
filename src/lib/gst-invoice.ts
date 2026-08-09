import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

/** Round to 2 decimal places using standard half-up rounding (paise-safe). */
export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export interface TaxSplit {
  cgst: number;
  sgst: number;
  igst: number;
}

/**
 * Same state (buyer state code === seller state code) -> CGST + SGST, split evenly.
 * Different state -> IGST only.
 *
 * The full tax amount is rounded once, then CGST/SGST are derived from that rounded
 * total (sgst = total - cgst) so the two halves always sum back exactly to the tax
 * shown on the invoice, even when the raw amount has an odd paisa (e.g. Rs 100.01 @ 18%).
 */
export function calculateTaxSplit(
  taxableValue: number,
  taxRatePercent: number,
  sellerStateCode: string,
  buyerStateCode: string
): TaxSplit {
  const totalTax = round2((taxableValue * taxRatePercent) / 100);

  if (sellerStateCode === buyerStateCode) {
    const cgst = round2(totalTax / 2);
    const sgst = round2(totalTax - cgst);
    return { cgst, sgst, igst: 0 };
  }

  return { cgst: 0, sgst: 0, igst: totalTax };
}

export interface InvoiceLineInput {
  itemId?: string;
  description: string;
  hsnCode: string;
  qty: number;
  rate: number;
  taxRate: number;
}

/** Shared by invoice create and edit: turns raw line inputs into priced line rows plus
 * the document-level subtotal/tax totals they roll up to. */
export function computeInvoiceLines(lines: InvoiceLineInput[], sellerStateCode: string, buyerStateCode: string) {
  let subtotal = 0;
  let cgstTotal = 0;
  let sgstTotal = 0;
  let igstTotal = 0;

  const lineData = lines.map((line) => {
    const taxableValue = round2(line.qty * line.rate);
    const split = calculateTaxSplit(taxableValue, line.taxRate, sellerStateCode, buyerStateCode);
    const lineTotal = round2(taxableValue + split.cgst + split.sgst + split.igst);

    subtotal += taxableValue;
    cgstTotal += split.cgst;
    sgstTotal += split.sgst;
    igstTotal += split.igst;

    return {
      itemId: line.itemId,
      description: line.description,
      hsnCode: line.hsnCode,
      qty: line.qty,
      rate: line.rate,
      taxableValue,
      taxRate: line.taxRate,
      cgstAmount: split.cgst,
      sgstAmount: split.sgst,
      igstAmount: split.igst,
      lineTotal,
    };
  });

  return {
    lineData,
    subtotal: round2(subtotal),
    cgstTotal: round2(cgstTotal),
    sgstTotal: round2(sgstTotal),
    igstTotal: round2(igstTotal),
  };
}

/** Indian financial year label for a date, e.g. 2026-07-01 -> "26-27". */
export function financialYearLabel(date: Date): string {
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth() + 1; // 1-12
  const fyStart = month >= 4 ? year : year - 1;
  const two = (y: number) => (y % 100).toString().padStart(2, "0");
  return `${two(fyStart)}-${two(fyStart + 1)}`;
}

export type BillableInvoiceType = "SALE" | "PROFORMA";

const INVOICE_PREFIXES: Record<BillableInvoiceType, (tenantPrefix: string) => string> = {
  SALE: (tenantPrefix) => tenantPrefix,
  PROFORMA: () => "PRO",
};

async function nextInvoiceNumber(
  tx: Prisma.TransactionClient,
  tenantId: string,
  invoicePrefix: string,
  type: BillableInvoiceType,
  date: Date
): Promise<string> {
  // Serialize invoice numbering per tenant so two concurrent requests never get the same sequence.
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${tenantId}))`;

  const fy = financialYearLabel(date);

  const counter = await tx.invoiceCounter.upsert({
    where: { tenantId_financialYear_type: { tenantId, financialYear: fy, type } },
    create: { tenantId, financialYear: fy, type, lastSequence: 1 },
    update: { lastSequence: { increment: 1 } },
  });

  return `${INVOICE_PREFIXES[type](invoicePrefix)}/${fy}/${counter.lastSequence}`;
}

export interface DispatchDetailsInput {
  poNumber?: string;
  poDate?: Date;
  vehicleNumber?: string;
  transportationMode?: string;
  reverseCharge?: boolean;
  deliveredThrough?: string;
  placeOfSupplySite?: string;
  /** The project/job Site (from the Sites feature) this invoice is raised against, e.g. "Pune". */
  siteId?: string;
  /** Free text shown on the printed invoice, e.g. "Due on Receipt", "Net 30", "Net 60". */
  paymentTerms?: string;
  shipToSameAsBilling?: boolean;
  shipToName?: string;
  shipToAddress?: string;
  shipToGstin?: string;
  shipToStateCode?: string;
}

export interface CreateSaleInvoiceInput extends DispatchDetailsInput {
  tenantId: string;
  customerId: string;
  lines: InvoiceLineInput[];
  discount?: number;
  dueDate?: Date;
  /** SALE creates a real GST liability and posts to the ledger. PROFORMA is a quote:
   * it still shows GST-inclusive pricing to the customer, but is non-GST-liable and
   * never touches the ledger, since it isn't a real debt until converted to a sale. */
  type?: BillableInvoiceType;
  /** SALE-only: same numbering series and ledger treatment as any other sale invoice --
   * just prints "Service Tax Invoice" instead of "Tax Invoice". */
  isServiceInvoice?: boolean;
  /** Internal, OWNER-only remark -- never printed or emailed to the customer. */
  conversionNote?: string;
}

export async function createSaleInvoice(input: CreateSaleInvoiceInput) {
  const {
    tenantId,
    customerId,
    lines,
    discount = 0,
    dueDate,
    type = "SALE",
    isServiceInvoice = false,
    poNumber,
    poDate,
    vehicleNumber,
    transportationMode,
    reverseCharge = false,
    deliveredThrough,
    placeOfSupplySite,
    siteId,
    paymentTerms,
    shipToSameAsBilling = true,
    shipToName,
    shipToAddress,
    shipToGstin,
    shipToStateCode,
    conversionNote,
  } = input;

  if (lines.length === 0) {
    throw new Error("Invoice must have at least one line item");
  }

  return prisma.$transaction(async (tx) => {
    const [tenant, customer] = await Promise.all([
      tx.tenant.findUniqueOrThrow({ where: { id: tenantId } }),
      tx.customer.findFirstOrThrow({ where: { id: customerId, tenantId } }),
      siteId ? tx.site.findFirstOrThrow({ where: { id: siteId, tenantId } }) : Promise.resolve(null),
    ]);

    const date = new Date();
    const number = await nextInvoiceNumber(tx, tenantId, tenant.invoicePrefix, type, date);

    const { lineData, subtotal, cgstTotal, sgstTotal, igstTotal } = computeInvoiceLines(
      lines,
      tenant.stateCode,
      customer.stateCode
    );

    const discountAmount = round2(discount);
    const total = round2(subtotal - discountAmount + cgstTotal + sgstTotal + igstTotal);

    const invoice = await tx.invoice.create({
      data: {
        tenantId,
        customerId,
        siteId,
        type,
        isServiceInvoice: type === "SALE" ? isServiceInvoice : false,
        number,
        date,
        dueDate,
        status: type === "PROFORMA" ? "DRAFT" : "SENT",
        subtotal,
        discount: discountAmount,
        cgst: cgstTotal,
        sgst: sgstTotal,
        igst: igstTotal,
        roundOff: 0,
        total,
        poNumber,
        poDate,
        vehicleNumber,
        transportationMode,
        reverseCharge,
        deliveredThrough,
        placeOfSupplySite,
        paymentTerms,
        shipToSameAsBilling,
        shipToName: shipToSameAsBilling ? undefined : shipToName,
        shipToAddress: shipToSameAsBilling ? undefined : shipToAddress,
        shipToGstin: shipToSameAsBilling ? undefined : shipToGstin,
        shipToStateCode: shipToSameAsBilling ? undefined : shipToStateCode,
        conversionNote,
        lines: { create: lineData },
      },
      include: { lines: true },
    });

    // A proforma is a quote, not a real debt -- it never posts to the ledger.
    // Converting it to a sale invoice later creates a fresh SALE invoice that does.
    if (type === "SALE") {
      // Serialize ledger writes per customer so the running balance never races.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${customerId}))`;

      const lastEntry = await tx.ledgerEntry.findFirst({
        where: { tenantId, customerId },
        orderBy: { createdAt: "desc" },
      });
      const previousBalance = lastEntry ? Number(lastEntry.runningBalance) : 0;
      const runningBalance = round2(previousBalance + total);

      await tx.ledgerEntry.create({
        data: {
          tenantId,
          partyType: "CUSTOMER",
          customerId,
          refType: "INVOICE",
          invoiceId: invoice.id,
          debit: total,
          credit: 0,
          runningBalance,
          description: `Invoice ${number} raised`,
          entryDate: date,
        },
      });
    }

    return invoice;
  });
}

export interface UpdateSaleInvoiceInput extends DispatchDetailsInput {
  tenantId: string;
  invoiceId: string;
  lines: InvoiceLineInput[];
  discount?: number;
  dueDate?: Date;
}

/** Edits an existing DRAFT/SENT invoice with no successful payment against it yet.
 * The customer and invoice number never change -- only line items, totals and dispatch
 * details. For a SALE invoice this also repoints the posted ledger entry at the new
 * total and replays the running balance forward for every later entry on that
 * customer's ledger, so the account balance never drifts from what was actually billed. */
export async function updateSaleInvoice(input: UpdateSaleInvoiceInput) {
  const {
    tenantId,
    invoiceId,
    lines,
    discount = 0,
    dueDate,
    poNumber,
    poDate,
    vehicleNumber,
    transportationMode,
    reverseCharge = false,
    deliveredThrough,
    placeOfSupplySite,
    siteId,
    paymentTerms,
    shipToSameAsBilling = true,
    shipToName,
    shipToAddress,
    shipToGstin,
    shipToStateCode,
  } = input;

  if (lines.length === 0) {
    throw new Error("Invoice must have at least one line item");
  }

  return prisma.$transaction(async (tx) => {
    const invoice = await tx.invoice.findFirst({
      where: { id: invoiceId, tenantId },
      include: { payments: true },
    });
    if (!invoice) {
      throw new Error("Invoice not found");
    }
    if (invoice.type === "CREDIT_NOTE") {
      throw new Error("Credit notes cannot be edited");
    }
    if (invoice.archivedAt) {
      throw new Error("Archived invoices cannot be edited");
    }
    if (invoice.status !== "DRAFT" && invoice.status !== "SENT") {
      throw new Error("Only draft or sent invoices can be edited");
    }
    if (invoice.payments.some((p) => p.status === "SUCCESS")) {
      throw new Error("Invoices with a recorded payment cannot be edited");
    }

    const [tenant, customer] = await Promise.all([
      tx.tenant.findUniqueOrThrow({ where: { id: tenantId } }),
      tx.customer.findFirstOrThrow({ where: { id: invoice.customerId, tenantId } }),
      siteId ? tx.site.findFirstOrThrow({ where: { id: siteId, tenantId } }) : Promise.resolve(null),
    ]);

    const { lineData, subtotal, cgstTotal, sgstTotal, igstTotal } = computeInvoiceLines(
      lines,
      tenant.stateCode,
      customer.stateCode
    );

    const discountAmount = round2(discount);
    const total = round2(subtotal - discountAmount + cgstTotal + sgstTotal + igstTotal);

    await tx.invoiceLine.deleteMany({ where: { invoiceId } });

    const updated = await tx.invoice.update({
      where: { id: invoiceId },
      data: {
        dueDate,
        subtotal,
        discount: discountAmount,
        cgst: cgstTotal,
        sgst: sgstTotal,
        igst: igstTotal,
        total,
        poNumber,
        poDate,
        vehicleNumber,
        transportationMode,
        reverseCharge,
        deliveredThrough,
        placeOfSupplySite,
        siteId,
        paymentTerms,
        shipToSameAsBilling,
        shipToName: shipToSameAsBilling ? null : shipToName,
        shipToAddress: shipToSameAsBilling ? null : shipToAddress,
        shipToGstin: shipToSameAsBilling ? null : shipToGstin,
        shipToStateCode: shipToSameAsBilling ? null : shipToStateCode,
        lines: { create: lineData },
      },
      include: { lines: true },
    });

    if (invoice.type === "SALE") {
      // Serialize ledger writes per customer so the running balance never races.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${invoice.customerId}))`;

      const entry = await tx.ledgerEntry.findFirst({
        where: { tenantId, invoiceId, refType: "INVOICE" },
      });

      if (entry) {
        const allEntries = await tx.ledgerEntry.findMany({
          where: { tenantId, customerId: invoice.customerId },
          orderBy: { createdAt: "asc" },
        });

        let running = 0;
        for (const e of allEntries) {
          const debit = e.id === entry.id ? total : Number(e.debit);
          const credit = Number(e.credit);
          running = round2(running + debit - credit);
          await tx.ledgerEntry.update({
            where: { id: e.id },
            data: {
              ...(e.id === entry.id ? { debit: total } : {}),
              runningBalance: running,
            },
          });
        }
      }
    }

    return updated;
  });
}

/** Converts an accepted PROFORMA into a real SALE invoice (fresh number, posts to the ledger)
 * and marks the original proforma as APPROVED, linked to the invoice it became. */
export async function convertProformaToSale(tenantId: string, proformaId: string, conversionNote?: string) {
  const proforma = await prisma.$transaction(async (tx) => {
    const p = await tx.invoice.findFirst({
      where: { id: proformaId, tenantId, type: "PROFORMA" },
      include: { lines: true },
    });
    if (!p) {
      throw new Error("Proforma invoice not found");
    }
    if (p.status === "CANCELLED" || p.status === "APPROVED") {
      throw new Error("This proforma has already been converted or cancelled");
    }

    await tx.invoice.update({ where: { id: p.id }, data: { status: "APPROVED" } });

    return p;
  });

  const invoice = await createSaleInvoice({
    tenantId,
    customerId: proforma.customerId,
    type: "SALE",
    discount: Number(proforma.discount),
    dueDate: proforma.dueDate ?? undefined,
    poNumber: proforma.poNumber ?? undefined,
    poDate: proforma.poDate ?? undefined,
    vehicleNumber: proforma.vehicleNumber ?? undefined,
    transportationMode: proforma.transportationMode ?? undefined,
    reverseCharge: proforma.reverseCharge,
    deliveredThrough: proforma.deliveredThrough ?? undefined,
    placeOfSupplySite: proforma.placeOfSupplySite ?? undefined,
    siteId: proforma.siteId ?? undefined,
    paymentTerms: proforma.paymentTerms ?? undefined,
    shipToSameAsBilling: proforma.shipToSameAsBilling,
    shipToName: proforma.shipToName ?? undefined,
    shipToAddress: proforma.shipToAddress ?? undefined,
    shipToGstin: proforma.shipToGstin ?? undefined,
    shipToStateCode: proforma.shipToStateCode ?? undefined,
    conversionNote: conversionNote?.trim() || undefined,
    lines: proforma.lines.map((l) => ({
      itemId: l.itemId ?? undefined,
      description: l.description,
      hsnCode: l.hsnCode,
      qty: Number(l.qty),
      rate: Number(l.rate),
      taxRate: Number(l.taxRate),
    })),
  });

  await prisma.invoice.update({
    where: { id: proforma.id },
    data: { convertedToInvoiceId: invoice.id },
  });

  return invoice;
}
