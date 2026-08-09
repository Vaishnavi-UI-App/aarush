import crypto from "node:crypto";
import { NextRequest } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";

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

/**
 * Same as getSession, but for Server Components / layouts using next/headers instead of a
 * NextRequest.
 *
 * The signed cookie only proves *who's logged in* (userId/tenantId) -- its roleId is a
 * snapshot from whenever the user last logged in, so it goes stale the moment an owner
 * reassigns that user's role. Every page render (sidebar, page-level `can()` gates) reads
 * roleId from here, so without this the promoted/demoted user won't see the change reflected
 * anywhere -- web or the Android app's WebView -- until they log out and back in. Re-reading
 * roleId from the user row on every call fixes that; it's a single indexed primary-key
 * lookup, cheap enough to not be worth caching against the request lifecycle.
 */
export async function getServerSession(): Promise<SessionPayload | null> {
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;
  if (!token) return null;
  const session = decodeSession(token);
  if (!session) return null;

  const user = await prisma.user.findUnique({ where: { id: session.userId }, select: { tenantId: true, roleId: true, archivedAt: true } });
  if (!user || user.tenantId !== session.tenantId || !user.roleId || user.archivedAt) return null;

  return { ...session, roleId: user.roleId };
}
