import { NextRequest, NextResponse } from "next/server";
import { verifyWebhookSignature } from "@/lib/razorpay";
import { prisma } from "@/lib/prisma";
import { round2 } from "@/lib/gst-invoice";

interface RazorpayWebhookBody {
  event: string;
  payload: {
    payment_link?: { entity: { id: string } };
    payment: { entity: { id: string; order_id?: string; amount: number; status: string } };
  };
}

const RELEVANT_EVENTS = new Set(["payment_link.paid", "payment.captured"]);

export async function POST(request: NextRequest) {
  // The signature is computed over the exact raw bytes Razorpay sent -- read text(),
  // never json(), or the HMAC will never match.
  const rawBody = await request.text();
  const signature = request.headers.get("x-razorpay-signature") ?? "";
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;

  if (!secret) {
    console.error("RAZORPAY_WEBHOOK_SECRET is not configured");
    return NextResponse.json({ error: "Webhook not configured" }, { status: 500 });
  }

  if (!verifyWebhookSignature(rawBody, signature, secret)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  const body: RazorpayWebhookBody = JSON.parse(rawBody);

  if (!RELEVANT_EVENTS.has(body.event)) {
    // Acknowledge anything we don't act on so Razorpay stops retrying it.
    return NextResponse.json({ received: true, ignored: body.event });
  }

  const paymentLinkId = body.payload.payment_link?.entity.id;
  const razorpayPaymentId = body.payload.payment.entity.id;
  const razorpayOrderId = body.payload.payment.entity.order_id;
  const amountReceived = round2(body.payload.payment.entity.amount / 100);

  if (!paymentLinkId) {
    return NextResponse.json({ error: "Missing payment_link in payload" }, { status: 400 });
  }

  const result = await prisma.$transaction(async (tx) => {
    const payment = await tx.payment.findUnique({
      where: { razorpayPaymentLinkId: paymentLinkId },
      include: { invoice: true },
    });

    if (!payment) {
      // Nothing we created a link for -- acknowledge so Razorpay doesn't retry forever,
      // but don't touch the ledger for a payment we have no record of.
      return { idempotentSkip: true as const };
    }

    // Idempotency: a duplicate delivery of the same webhook (or a retried one) must not
    // post a second ledger entry. razorpayPaymentId is unique, and we short-circuit here too.
    if (payment.status === "SUCCESS" || payment.razorpayPaymentId === razorpayPaymentId) {
      return { idempotentSkip: true as const };
    }

    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${payment.customerId}))`;

    await tx.payment.update({
      where: { id: payment.id },
      data: {
        status: "SUCCESS",
        razorpayPaymentId,
        razorpayOrderId,
        amount: amountReceived,
      },
    });

    const lastEntry = await tx.ledgerEntry.findFirst({
      where: { tenantId: payment.tenantId, customerId: payment.customerId },
      orderBy: { createdAt: "desc" },
    });
    const previousBalance = lastEntry ? Number(lastEntry.runningBalance) : 0;
    const runningBalance = round2(previousBalance - amountReceived);

    await tx.ledgerEntry.create({
      data: {
        tenantId: payment.tenantId,
        partyType: "CUSTOMER",
        customerId: payment.customerId,
        refType: "PAYMENT",
        paymentId: payment.id,
        invoiceId: payment.invoiceId,
        debit: 0,
        credit: amountReceived,
        runningBalance,
        description: `Razorpay payment received (${razorpayPaymentId})`,
      },
    });

    if (payment.invoiceId) {
      const successPayments = await tx.payment.findMany({
        where: { invoiceId: payment.invoiceId, status: "SUCCESS" },
      });
      const totalPaid = round2(successPayments.reduce((sum, p) => sum + Number(p.amount), 0));
      const invoiceTotal = Number(payment.invoice?.total ?? 0);

      const newStatus = totalPaid >= invoiceTotal ? "PAID" : totalPaid > 0 ? "PARTIALLY_PAID" : "SENT";

      await tx.invoice.update({
        where: { id: payment.invoiceId },
        data: { status: newStatus },
      });
    }

    return { idempotentSkip: false as const };
  });

  return NextResponse.json({ received: true, ...result });
}
