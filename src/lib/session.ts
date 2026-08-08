import crypto from "node:crypto";
import { NextRequest } from "next/server";
import { cookies } from "next/headers";

export interface SessionPayload {
  userId: string;
  tenantId: string;
  roleId: string;
}

const COOKIE_NAME = "session";

function getSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    throw new Error("SESSION_SECRET is not set. Add it to .env.local.");
  }
  return secret;
}

function sign(payloadB64: string): string {
  return crypto.createHmac("sha256", getSecret()).update(payloadB64).digest("base64url");
}

/** Signs a session payload into a `payload.signature` cookie value. Never trust an unsigned value. */
export function encodeSession(payload: SessionPayload): string {
  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${payloadB64}.${sign(payloadB64)}`;
}

function decodeSession(token: string): SessionPayload | null {
  const [payloadB64, signature] = token.split(".");
  if (!payloadB64 || !signature) return null;

  const expected = sign(payloadB64);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;

  try {
    return JSON.parse(Buffer.from(payloadB64, "base64url").toString("utf8"));
  } catch {
    return null;
  }
}

/**
 * Derives the authenticated session from the signed `session` cookie only.
 * Route handlers must call this instead of reading tenantId/customerId from the
 * request body or query string -- a client can put anything there.
 */
export function getSession(request: NextRequest): SessionPayload | null {
  const token = request.cookies.get(COOKIE_NAME)?.value;
  if (!token) return null;
  return decodeSession(token);
}

export function requireSession(request: NextRequest): SessionPayload {
  const session = getSession(request);
  if (!session) {
    throw new SessionError("Not authenticated");
  }
  return session;
}

export class SessionError extends Error {}

export const SESSION_COOKIE_NAME = COOKIE_NAME;

/** Same as getSession, but for Server Components / layouts using next/headers instead of a NextRequest. */
export async function getServerSession(): Promise<SessionPayload | null> {
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;
  if (!token) return null;
  return decodeSession(token);
}
