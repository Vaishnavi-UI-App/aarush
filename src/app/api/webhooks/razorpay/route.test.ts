import crypto from "node:crypto";
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const transactionSpy = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    $transaction: transactionSpy,
  },
}));

const SECRET = "whsec_test_1234567890";
process.env.RAZORPAY_WEBHOOK_SECRET = SECRET;

function sign(body: string): string {
  return crypto.createHmac("sha256", SECRET).update(body).digest("hex");
}

function makeRequest(rawBody: string, signature: string) {
  return new NextRequest("http://localhost/api/webhooks/razorpay", {
    method: "POST",
    body: rawBody,
    headers: { "x-razorpay-signature": signature, "content-type": "application/json" },
  });
}

const samplePayload = JSON.stringify({
  event: "payment_link.paid",
  payload: {
    payment_link: { entity: { id: "plink_test123" } },
    payment: { entity: { id: "pay_test123", amount: 100000, status: "captured" } },
  },
});

describe("POST /api/webhooks/razorpay", () => {
  beforeEach(() => {
    transactionSpy.mockReset();
  });

  it("rejects an invalid signature with 401 and never touches the database", async () => {
    const { POST } = await import("./route");

    const res = await POST(makeRequest(samplePayload, "not-the-real-signature"));

    expect(res.status).toBe(401);
    expect(transactionSpy).not.toHaveBeenCalled();
  });

  it("rejects a signature computed over a different body (tampered payload) with 401", async () => {
    const { POST } = await import("./route");

    const validSignatureForADifferentBody = sign(JSON.stringify({ event: "payment_link.paid", payload: {} }));
    const res = await POST(makeRequest(samplePayload, validSignatureForADifferentBody));

    expect(res.status).toBe(401);
    expect(transactionSpy).not.toHaveBeenCalled();
  });

  it("accepts a correctly signed payload and proceeds to process it", async () => {
    transactionSpy.mockResolvedValue({ idempotentSkip: false });
    const { POST } = await import("./route");

    const res = await POST(makeRequest(samplePayload, sign(samplePayload)));

    expect(res.status).toBe(200);
    expect(transactionSpy).toHaveBeenCalledTimes(1);
  });
});
