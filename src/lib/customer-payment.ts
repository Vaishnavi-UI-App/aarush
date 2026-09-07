import crypto from "node:crypto";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { round2 } from "@/lib/gst-invoice";

type Tx = Prisma.TransactionClient;

export interface RecordCustomerPaymentInput {
  tenantId: string;
  customerId: string;
  invoiceId?: string;
  amount: number;
  mode: "CASH" | "UPI" | "BANK_TRANSFER" | "CHEQUE" | "OTHER";
  referenceNo?: string;
  // Correlates the several Payment rows created from one multi-invoice "Record
  // Payment" submission, so the customer statement can show them as one entry.
  batchId?: string;
}

/** Re-derives one invoice's status from whichever of its payments are still
 * SUCCESS, after a payment against it was just recorded or deleted. */
async function recomputeInvoiceStatus(tx: Tx, invoiceId: string) {
  const successPayments = await tx.payment.findMany({ where: { invoiceId, status: "SUCCESS" } });
  const totalPaid = round2(successPayments.reduce((sum, p) => sum + Number(p.amount), 0));
  const invoice = await tx.invoice.findUniqueOrThrow({ where: { id: invoiceId } });
  const newStatus = totalPaid >= Number(invoice.total) ? "PAID" : totalPaid > 0 ? "PARTIALLY_PAID" : "SENT";
  await tx.invoice.update({ where: { id: invoiceId }, data: { status: newStatus } });
}

/** Recomputes every ledger entry's running balance for a customer from scratch, in
 * date order -- used after deleting a payment from the middle of the history, since
 * every entry after it is now off by that amount. */
async function recomputeCustomerLedgerBalances(tx: Tx, tenantId: string, customerId: string) {
  const entries = await tx.ledgerEntry.findMany({
    where: { tenantId, customerId },
    orderBy: { createdAt: "asc" },
  });
  let balance = 0;
  for (const entry of entries) {
    balance = round2(balance + Number(entry.debit) - Number(entry.credit));
    if (Number(entry.runningBalance) !== balance) {
      await tx.ledgerEntry.update({ where: { id: entry.id }, data: { runningBalance: balance } });
    }
  }
}

async function recordCustomerPaymentInTx(tx: Tx, input: RecordCustomerPaymentInput) {
  const { tenantId, customerId, invoiceId, amount, mode, referenceNo, batchId } = input;

  if (!(amount > 0)) {
    throw new Error("Payment amount must be greater than zero");
  }

  await tx.customer.findFirstOrThrow({ where: { id: customerId, tenantId } });
  let invoiceNumber: string | undefined;
  if (invoiceId) {
    invoiceNumber = (await tx.invoice.findFirstOrThrow({ where: { id: invoiceId, tenantId, customerId } })).number;
  }

  const payment = await tx.payment.create({
    data: { tenantId, customerId, invoiceId, amount, mode, status: "SUCCESS", referenceNo, batchId },
  });

  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${customerId}))`;

  const lastEntry = await tx.ledgerEntry.findFirst({
    where: { tenantId, customerId },
    orderBy: { createdAt: "desc" },
  });
  const previousBalance = lastEntry ? Number(lastEntry.runningBalance) : 0;
  const runningBalance = round2(previousBalance - amount);

  // Name which invoice this credit closed out (or flag it as an unapplied advance) --
  // otherwise every payment row on the statement reads as identical "Payment
  // received" text, and a customer with several allocations from one lump sum has no
  // way to tell them apart.
  const descriptionParts = [invoiceId ? `Payment received against ${invoiceNumber}` : "Payment received (advance / unapplied)"];
  if (referenceNo) descriptionParts.push(`(${referenceNo})`);

  await tx.ledgerEntry.create({
    data: {
      tenantId,
      partyType: "CUSTOMER",
      customerId,
      refType: "PAYMENT",
      paymentId: payment.id,
      invoiceId,
      debit: 0,
      credit: amount,
      runningBalance,
      description: descriptionParts.join(" "),
    },
  });

  if (invoiceId) {
    await recomputeInvoiceStatus(tx, invoiceId);
  }

  return payment;
}

/** Records a payment received from a customer outside the Razorpay flow (cash, UPI,
 * cheque, etc). Mirrors the webhook handler's ledger-posting + invoice-status logic
 * so manual and Razorpay payments stay consistent. */
export async function recordCustomerPayment(input: RecordCustomerPaymentInput) {
  return prisma.$transaction((tx) => recordCustomerPaymentInTx(tx, input));
}

export interface PaymentAllocation {
  invoiceId?: string;
  amount: number;
}

/** Deletes a mistaken/duplicate payment entry: removes the Payment and its
 * ledger row, recomputes every later ledger entry's running balance for that
 * customer, and re-derives the invoice's status from whatever payments remain.
 * This only corrects the books -- it doesn't reverse money in the real world,
 * so it's meant for entry errors, not refunds. */
export async function deleteCustomerPayment(tenantId: string, paymentId: string) {
  return prisma.$transaction(async (tx) => {
    const payment = await tx.payment.findFirst({ where: { id: paymentId, tenantId } });
    if (!payment) throw new Error("Payment not found");

    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${payment.customerId}))`;

    await tx.ledgerEntry.deleteMany({ where: { tenantId, paymentId } });
    await tx.payment.delete({ where: { id: paymentId } });

    await recomputeCustomerLedgerBalances(tx, tenantId, payment.customerId);
    if (payment.invoiceId) {
      await recomputeInvoiceStatus(tx, payment.invoiceId);
    }

    return payment;
  });
}

/** Deletes every payment in one multi-invoice "Record Payment" batch together --
 * the collapsed-entry counterpart to deleteCustomerPayment above. Same correction-
 * only caveat: it fixes the books, not real-world money. */
export async function deleteCustomerPaymentBatch(tenantId: string, batchId: string) {
  return prisma.$transaction(async (tx) => {
    const payments = await tx.payment.findMany({ where: { tenantId, batchId } });
    if (payments.length === 0) throw new Error("Payment batch not found");
    const customerId = payments[0].customerId;

    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${customerId}))`;

    await tx.ledgerEntry.deleteMany({ where: { tenantId, paymentId: { in: payments.map((p) => p.id) } } });
    await tx.payment.deleteMany({ where: { tenantId, batchId } });

    await recomputeCustomerLedgerBalances(tx, tenantId, customerId);
    const invoiceIds = [...new Set(payments.map((p) => p.invoiceId).filter((id): id is string => !!id))];
    for (const invoiceId of invoiceIds) {
      await recomputeInvoiceStatus(tx, invoiceId);
    }

    return { count: payments.length };
  });
}

/** Records one payment received from a customer, split across several invoices (or
 * left as a general/unapplied credit) in a single amount the customer handed over --
 * e.g. paying off two older bills in full and putting the rest toward a third. Each
 * allocation becomes its own Payment + LedgerEntry row (so per-invoice status stays
 * correct and each carries its own "against INV/..." description), but they all
 * share one batchId when there's more than one, so the customer statement can
 * collapse them into a single entry instead of one row per invoice -- and all of
 * them commit together in one transaction. */
export async function recordCustomerPaymentAllocations(
  tenantId: string,
  customerId: string,
  mode: RecordCustomerPaymentInput["mode"],
  referenceNo: string | undefined,
  allocations: PaymentAllocation[]
) {
  if (allocations.length === 0) {
    throw new Error("At least one payment allocation is required");
  }
  for (const a of allocations) {
    if (!(a.amount > 0)) {
      throw new Error("Each allocation amount must be greater than zero");
    }
  }

  const batchId = allocations.length > 1 ? crypto.randomUUID() : undefined;

  return prisma.$transaction(async (tx) => {
    const payments = [];
    for (const allocation of allocations) {
      payments.push(
        await recordCustomerPaymentInTx(tx, {
          tenantId,
          customerId,
          invoiceId: allocation.invoiceId,
          amount: allocation.amount,
          mode,
          referenceNo,
          batchId,
        })
      );
    }
    return payments;
  });
}
