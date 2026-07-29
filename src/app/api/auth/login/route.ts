import { NextRequest, NextResponse } from "next/server";
import { encodeSession, SESSION_COOKIE_NAME } from "@/lib/session";
import { prisma } from "@/lib/prisma";

/**
 * DEV-ONLY sign-in: looks a user up by email with no password check and issues a
 * signed session cookie. This stands in for real authentication (Section 5.2 of the
 * build spec: password hashing, JWT rotation, 2FA) which hasn't been built yet.
 * Never wire this up in production as-is.
 */
export async function POST(request: NextRequest) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not available in production" }, { status: 404 });
  }

  const { email } = await request.json();
  if (!email || typeof email !== "string") {
    return NextResponse.json({ error: "email is required" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    return NextResponse.json({ error: "No user with that email" }, { status: 404 });
  }

  const token = encodeSession({ userId: user.id, tenantId: user.tenantId, role: user.role });

  const res = NextResponse.json({ success: true });
  res.cookies.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24,
  });
  return res;
}
