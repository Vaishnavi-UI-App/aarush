import { prisma } from "@/lib/prisma";
import { round2 } from "@/lib/gst-invoice";

export interface RecordCustomerPaymentInput {
  tenantId: string;
  customerId: string;
  invoiceId?: string;
  amount: number;
  mode: "CASH" | "UPI" | "BANK_TRANSFER" | "CHEQUE" | "OTHER";
  referenceNo?: string;
}

/** Records a payment received from a customer outside the Razorpay flow (cash, UPI,
 * cheque, etc). Mirrors the webhook handler's ledger-posting + invoice-status logic
 * so manual and Razorpay payments stay consistent. */
export async function recordCustomerPayment(input: RecordCustomerPaymentInput) {
  const { tenantId, customerId, invoiceId, amount, mode, referenceNo } = input;

  if (!(amount > 0)) {
    throw new Error("Payment amount must be greater than zero");
  }

  return prisma.$transaction(async (tx) => {
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
  });
}
