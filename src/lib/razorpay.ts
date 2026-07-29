import crypto from "node:crypto";
import Razorpay from "razorpay";

let client: Razorpay | null = null;

export function getRazorpayClient(): Razorpay {
  if (client) return client;

  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !keySecret) {
    throw new Error("RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET are not configured");
  }

  client = new Razorpay({ key_id: keyId, key_secret: keySecret });
  return client;
}

/**
 * Verifies a Razorpay webhook signature. `rawBody` MUST be the exact bytes Razorpay
 * sent (before any JSON.parse) -- the HMAC is computed over the raw request body,
 * so re-serializing the parsed JSON would produce a different signature and always fail.
 */
export function verifyWebhookSignature(rawBody: string, signature: string, secret: string): boolean {
  if (!signature) return false;

  const expected = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");

  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}
