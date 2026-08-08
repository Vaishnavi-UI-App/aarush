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
}

async function recordCustomerPaymentInTx(tx: Tx, input: RecordCustomerPaymentInput) {
  const { tenantId, customerId, invoiceId, amount, mode, referenceNo } = input;

  if (!(amount > 0)) {
    throw new Error("Payment amount must be greater than zero");
  }

  await tx.customer.findFirstOrThrow({ where: { id: customerId, tenantId } });
  if (invoiceId) {
    await tx.invoice.findFirstOrThrow({ where: { id: invoiceId, tenantId, customerId } });
  }

  const payment = await tx.payment.create({
    data: { tenantId, customerId, invoiceId, amount, mode, status: "SUCCESS", referenceNo },
  });

  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${customerId}))`;

  const lastEntry = await tx.ledgerEntry.findFirst({
    where: { tenantId, customerId },
    orderBy: { createdAt: "desc" },
  });
  const previousBalance = lastEntry ? Number(lastEntry.runningBalance) : 0;
  const runningBalance = round2(previousBalance - amount);

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
      description: `Payment received${referenceNo ? ` (${referenceNo})` : ""}`,
    },
  });

  if (invoiceId) {
    const successPayments = await tx.payment.findMany({ where: { invoiceId, status: "SUCCESS" } });
    const totalPaid = round2(successPayments.reduce((sum, p) => sum + Number(p.amount), 0));
    const invoice = await tx.invoice.findUniqueOrThrow({ where: { id: invoiceId } });
    const newStatus = totalPaid >= Number(invoice.total) ? "PAID" : totalPaid > 0 ? "PARTIALLY_PAID" : "SENT";
    await tx.invoice.update({ where: { id: invoiceId }, data: { status: newStatus } });
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

/** Records one payment received from a customer, split across several invoices (or
 * left as a general/unapplied credit) in a single amount the customer handed over --
 * e.g. paying off two older bills in full and putting the rest toward a third. Each
 * allocation becomes its own Payment + LedgerEntry row (so per-invoice status and
 * the statement both read the same as if these had been recorded one at a time),
 * but all of them commit together in one transaction. */
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
        })
      );
    }
    return payments;
  });
}
