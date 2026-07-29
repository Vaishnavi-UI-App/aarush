import crypto from "node:crypto";
import { describe, expect, it } from "vitest";
import { verifyWebhookSignature } from "./razorpay";

const SECRET = "test_webhook_secret";

function sign(body: string, secret: string): string {
  return crypto.createHmac("sha256", secret).update(body).digest("hex");
}

describe("verifyWebhookSignature", () => {
  it("accepts a signature computed with the correct secret over the exact raw body", () => {
    const rawBody = JSON.stringify({ event: "payment_link.paid", payload: { payment: { entity: { id: "pay_123" } } } });
    const signature = sign(rawBody, SECRET);

    expect(verifyWebhookSignature(rawBody, signature, SECRET)).toBe(true);
  });

  it("rejects a signature computed with the wrong secret", () => {
    const rawBody = JSON.stringify({ event: "payment_link.paid" });
    const signature = sign(rawBody, "wrong_secret");

    expect(verifyWebhookSignature(rawBody, signature, SECRET)).toBe(false);
  });

  it("rejects a body that was tampered with after signing", () => {
    const originalBody = JSON.stringify({ event: "payment_link.paid", amount: 100 });
    const signature = sign(originalBody, SECRET);
    const tamperedBody = JSON.stringify({ event: "payment_link.paid", amount: 100000 });

    expect(verifyWebhookSignature(tamperedBody, signature, SECRET)).toBe(false);
  });

  it("rejects a missing signature", () => {
    const rawBody = JSON.stringify({ event: "payment_link.paid" });
    expect(verifyWebhookSignature(rawBody, "", SECRET)).toBe(false);
  });

  it("rejects a signature of a different length without throwing", () => {
    const rawBody = JSON.stringify({ event: "payment_link.paid" });
    expect(verifyWebhookSignature(rawBody, "short", SECRET)).toBe(false);
  });
});
