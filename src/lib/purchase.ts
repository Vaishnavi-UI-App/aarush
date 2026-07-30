import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { calculateTaxSplit, financialYearLabel, round2, InvoiceLineInput } from "@/lib/gst-invoice";

async function nextPurchaseNumber(tx: Prisma.TransactionClient, tenantId: string, date: Date): Promise<string> {
  // Serialize numbering per tenant, same pattern as sales/proforma invoice numbering.
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${tenantId}))`;

  const fy = financialYearLabel(date);

  const counter = await tx.purchaseCounter.upsert({
    where: { tenantId_financialYear: { tenantId, financialYear: fy } },
    create: { tenantId, financialYear: fy, lastSequence: 1 },
    update: { lastSequence: { increment: 1 } },
  });

  return `PB/${fy}/${counter.lastSequence}`;
}

export interface CreatePurchaseBillInput {
  tenantId: string;
  vendorId: string;
  lines: InvoiceLineInput[];
  discount?: number;
  dueDate?: Date;
  /** The vendor's own bill/invoice number, for 3-way matching against a PO and receipt. */
  vendorBillNumber?: string;
}

/** Records a bill received from a vendor. Mirrors createSaleInvoice on the vendor side:
 * one transaction creates the Purchase + lines, posts a debit to the vendor's ledger
 * (debit = what we now owe the vendor), and increments on-hand stock for any line tied
 * to a catalog item -- a purchase bill is what actually brings stock into the business. */
export async function createPurchaseBill(input: CreatePurchaseBillInput) {
  const { tenantId, vendorId, lines, discount = 0, dueDate, vendorBillNumber } = input;

  if (lines.length === 0) {
    throw new Error("Purchase bill must have at least one line item");
  }

  return prisma.$transaction(async (tx) => {
    const [tenant, vendor] = await Promise.all([
      tx.tenant.findUniqueOrThrow({ where: { id: tenantId } }),
      tx.vendor.findFirstOrThrow({ where: { id: vendorId, tenantId } }),
    ]);

    const date = new Date();
    const number = await nextPurchaseNumber(tx, tenantId, date);

    let subtotal = 0;
    let cgstTotal = 0;
    let sgstTotal = 0;
    let igstTotal = 0;

    const lineData = lines.map((line) => {
      const taxableValue = round2(line.qty * line.rate);
      const split = calculateTaxSplit(taxableValue, line.taxRate, tenant.stateCode, vendor.stateCode);
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

    subtotal = round2(subtotal);
    cgstTotal = round2(cgstTotal);
    sgstTotal = round2(sgstTotal);
    igstTotal = round2(igstTotal);

    const discountAmount = round2(discount);
    const total = round2(subtotal - discountAmount + cgstTotal + sgstTotal + igstTotal);

    const purchase = await tx.purchase.create({
      data: {
        tenantId,
        vendorId,
        number,
        vendorBillNumber,
        date,
        dueDate,
        status: "RECEIVED",
        subtotal,
        discount: discountAmount,
        cgst: cgstTotal,
        sgst: sgstTotal,
        igst: igstTotal,
        total,
        lines: { create: lineData },
      },
      include: { lines: true },
    });

    // A purchase bill is what actually brings stock into the business -- bump each
    // catalog item's on-hand quantity by what was received on this bill.
    for (const line of lines) {
      if (line.itemId) {
        await tx.item.update({
          where: { id: line.itemId },
          data: { currentStock: { increment: line.qty } },
        });
      }
    }

    // Serialize ledger writes per vendor so the running balance never races.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${vendorId}))`;

    const lastEntry = await tx.ledgerEntry.findFirst({
      where: { tenantId, vendorId },
      orderBy: { createdAt: "desc" },
    });
    const previousBalance = lastEntry ? Number(lastEntry.runningBalance) : 0;
    const runningBalance = round2(previousBalance + total);

    await tx.ledgerEntry.create({
      data: {
        tenantId,
        partyType: "VENDOR",
        vendorId,
        refType: "PURCHASE",
        purchaseId: purchase.id,
        debit: total,
        credit: 0,
        runningBalance,
        description: `Purchase bill ${number} received`,
        entryDate: date,
      },
    });

    return purchase;
  });
}

export interface RecordVendorPaymentInput {
  tenantId: string;
  vendorId: string;
  purchaseId?: string;
  amount: number;
  mode: "CASH" | "UPI" | "BANK_TRANSFER" | "CHEQUE" | "OTHER";
  referenceNo?: string;
}

/** Records a payment WE make to a vendor. Posts a credit to the vendor ledger
 * (reduces what we owe) in the same transaction as the VendorPayment row. */
export async function recordVendorPayment(input: RecordVendorPaymentInput) {
  const { tenantId, vendorId, purchaseId, amount, mode, referenceNo } = input;

  if (!(amount > 0)) {
    throw new Error("Payment amount must be greater than zero");
  }

  return prisma.$transaction(async (tx) => {
    await tx.vendor.findFirstOrThrow({ where: { id: vendorId, tenantId } });

    const payment = await tx.vendorPayment.create({
      data: { tenantId, vendorId, purchaseId, amount, mode, status: "SUCCESS", referenceNo },
    });

    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${vendorId}))`;

    const lastEntry = await tx.ledgerEntry.findFirst({
      where: { tenantId, vendorId },
      orderBy: { createdAt: "desc" },
    });
    const previousBalance = lastEntry ? Number(lastEntry.runningBalance) : 0;
    const runningBalance = round2(previousBalance - amount);

    await tx.ledgerEntry.create({
      data: {
        tenantId,
        partyType: "VENDOR",
        vendorId,
        refType: "VENDOR_PAYMENT",
        vendorPaymentId: payment.id,
        purchaseId,
        debit: 0,
        credit: amount,
        runningBalance,
        description: `Payment made to vendor${referenceNo ? ` (${referenceNo})` : ""}`,
      },
    });

    if (purchaseId) {
      const successPayments = await tx.vendorPayment.findMany({
        where: { purchaseId, status: "SUCCESS" },
      });
      const totalPaid = round2(successPayments.reduce((sum, p) => sum + Number(p.amount), 0));
      const purchase = await tx.purchase.findUniqueOrThrow({ where: { id: purchaseId } });
      const newStatus = totalPaid >= Number(purchase.total) ? "PAID" : totalPaid > 0 ? "PARTIALLY_PAID" : "RECEIVED";
      await tx.purchase.update({ where: { id: purchaseId }, data: { status: newStatus } });
    }

    return payment;
  });
}
