import { NextRequest, NextResponse } from "next/server";
import { requireSession, SessionError, SESSION_COOKIE_NAME } from "@/lib/session";
import { getRazorpayClient } from "@/lib/razorpay";
import { prisma } from "@/lib/prisma";
import { generateRealInvoicePdf } from "@/lib/generate-real-invoice-pdf";
import { INTERNAL_ORIGIN } from "@/lib/internal-origin";
import { sendMail } from "@/lib/mailer";
import { can } from "@/lib/permissions";

export async function POST(request: NextRequest) {
  let session;
  try {
    session = requireSession(request);
  } catch (e) {
    if (e instanceof SessionError) return NextResponse.json({ error: e.message }, { status: 401 });
    throw e;
  }
  if (!(await can(session.tenantId, session.roleId, "invoices", "edit"))) return NextResponse.json({ error: "View-only access" }, { status: 403 });

  const { invoiceId } = await request.json();
  if (!invoiceId) {
    return NextResponse.json({ error: "invoiceId is required" }, { status: 400 });
  }

  // Scoped by tenantId from the session -- never trust an invoiceId across tenants.
  const invoice = await prisma.invoice.findFirst({
    where: { id: invoiceId, tenantId: session.tenantId },
    include: {
      customer: true,
      payments: { orderBy: { createdAt: "desc" } },
    },
  });
  if (!invoice) {
    return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
  }
  if (invoice.status === "PAID" || invoice.status === "CANCELLED") {
    return NextResponse.json({ error: `Invoice is already ${invoice.status.toLowerCase()}` }, { status: 400 });
  }

  const paidSoFar = invoice.payments
    .filter((p) => p.status === "SUCCESS")
    .reduce((sum, p) => sum + Number(p.amount), 0);
  const amountDue = Number(invoice.total) - paidSoFar;
  if (amountDue <= 0) {
    return NextResponse.json({ error: "Nothing due on this invoice" }, { status: 400 });
  }

  const appBaseUrl = process.env.APP_BASE_URL ?? request.nextUrl.origin;

  let paymentLink;
  try {
    const razorpay = getRazorpayClient();

    // Razorpay rejects a second payment_link.create() with the same reference_id --
    // reusing invoice.id as the reference_id means retrying (e.g. clicking "email" twice)
    // would always fail that way. Reuse a still-active link from a prior attempt instead
    // of erroring out (which previously caused the app to silently fall back to an email
    // with no payment link at all).
    const existingPending = invoice.payments.find((p) => p.mode === "RAZORPAY" && p.status === "PENDING" && p.razorpayPaymentLinkId);
    let reused = false;

    if (existingPending?.razorpayPaymentLinkId) {
      const existing = await razorpay.paymentLink.fetch(existingPending.razorpayPaymentLinkId);
      if (existing.status === "created" || existing.status === "partially_paid") {
        paymentLink = existing;
        reused = true;
      }
    }

    if (!reused) {
      paymentLink = await razorpay.paymentLink.create({
        amount: Math.round(amountDue * 100), // paise
        currency: "INR",
        accept_partial: true,
        description: `Payment for invoice ${invoice.number}`,
        // Expired/cancelled links still occupy their reference_id forever on Razorpay's
        // side, so a plain retry needs a fresh one rather than colliding with the dead link.
        reference_id: existingPending ? `${invoice.id}-${Date.now()}` : invoice.id,
        customer: {
          name: invoice.customer.name,
          email: invoice.customer.email ?? undefined,
          contact: invoice.customer.phone ?? undefined,
        },
        // We send our own branded email with the invoice PDF attached below, so Razorpay's
        // own (attachment-less) notifications would just be a confusing duplicate.
        notify: { sms: !!invoice.customer.phone, email: false },
        callback_url: `${appBaseUrl}/invoices/${invoice.id}`,
        callback_method: "get",
      });

      await prisma.payment.create({
        data: {
          tenantId: session.tenantId,
          customerId: invoice.customerId,
          invoiceId: invoice.id,
          amount: amountDue,
          mode: "RAZORPAY",
          status: "PENDING",
          razorpayPaymentLinkId: paymentLink.id,
        },
      });
    }
  } catch (e) {
    console.error("Failed to create Razorpay payment link:", e);
    const razorpayMessage = extractRazorpayErrorMessage(e);
    return NextResponse.json(
      { error: razorpayMessage ?? "Could not create payment link" },
      { status: razorpayMessage ? 400 : 502 }
    );
  }

  if (!paymentLink) {
    return NextResponse.json({ error: "Could not create payment link" }, { status: 502 });
  }

  let emailed = false;
  let emailError: string | null = null;

  if (invoice.customer.email) {
    try {
      emailed = await emailInvoiceWithPaymentLink({
        origin: INTERNAL_ORIGIN,
        sessionToken: request.cookies.get(SESSION_COOKIE_NAME)?.value,
        invoiceId: invoice.id,
        invoiceNumber: invoice.number,
        customerName: invoice.customer.name,
        customerEmail: invoice.customer.email,
        amountDue,
        paymentLinkUrl: paymentLink.short_url,
      });
    } catch (e) {
      console.error("Payment link created but emailing the customer failed:", e);
      emailError = e instanceof Error ? e.message : "Failed to email the customer";
    }
  }

  return NextResponse.json({
    paymentLinkUrl: paymentLink.short_url,
    paymentLinkId: paymentLink.id,
    emailed,
    emailError,
  });
}

async function emailInvoiceWithPaymentLink(args: {
  origin: string;
  sessionToken: string | undefined;
  invoiceId: string;
  invoiceNumber: string;
  customerName: string;
  customerEmail: string;
  amountDue: number;
  paymentLinkUrl: string;
}): Promise<boolean> {
  const pdfBuffer = await generateRealInvoicePdf(args.origin, args.sessionToken, args.invoiceId);

  await sendMail({
    to: args.customerEmail,
    subject: `Payment Request: Invoice ${args.invoiceNumber} - Rs. ${args.amountDue.toFixed(2)} due`,
    text: `Dear ${args.customerName},\n\nPlease find attached invoice ${args.invoiceNumber}. An amount of Rs. ${args.amountDue.toFixed(2)} is due.\n\nYou can pay securely online here:\n${args.paymentLinkUrl}\n\nThank you for your business.`,
    attachments: [
      {
        filename: `${args.invoiceNumber.replace(/\//g, "-")}.pdf`,
        content: pdfBuffer,
      },
    ],
  });
  return true;
}

/** Razorpay's SDK throws a plain object shaped like { statusCode, error: { description } },
 * not an Error instance -- pull the human-readable reason out of it so the UI can show
 * the real cause (e.g. "amount exceeds maximum amount allowed") instead of a generic failure. */
function extractRazorpayErrorMessage(e: unknown): string | null {
  if (typeof e === "object" && e !== null && "error" in e) {
    const inner = (e as { error?: { description?: string } }).error;
    if (inner?.description) return inner.description;
  }
  return null;
}
