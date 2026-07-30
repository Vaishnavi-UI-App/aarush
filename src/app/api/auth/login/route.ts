import { NextRequest, NextResponse } from "next/server";
import { encodeSession, SESSION_COOKIE_NAME } from "@/lib/session";
import { prisma } from "@/lib/prisma";

/**
 * TEMPORARY sign-in: looks a user up by email with no password check and issues a
 * signed session cookie. This stands in for real authentication (Section 5.2 of the
 * build spec: password hashing, JWT rotation, 2FA) which hasn't been built yet.
 * Anyone who knows a user's email can sign in as them -- replace with real password
 * auth before onboarding real customers.
 */
export async function POST(request: NextRequest) {
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
    secure: request.nextUrl.protocol === "https:",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24,
  });
  return res;
}
