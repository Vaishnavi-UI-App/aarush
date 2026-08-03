import { NextRequest, NextResponse } from "next/server";
import { encodeSession, SESSION_COOKIE_NAME } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { verifyPassword } from "@/lib/password";

export async function POST(request: NextRequest) {
  const { email, password } = await request.json();
  if (!email || typeof email !== "string" || !password || typeof password !== "string") {
    return NextResponse.json({ error: "email and password are required" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
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
