import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/password";
import { consumePasswordResetToken } from "@/lib/password-reset";

export async function POST(request: NextRequest) {
  const { token, password } = await request.json().catch(() => ({}));
  if (!token || typeof token !== "string" || !password || typeof password !== "string") {
    return NextResponse.json({ error: "token and password are required" }, { status: 400 });
  }
  if (password.length < 8) {
    return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });
  }

  const userId = await consumePasswordResetToken(token);
  if (!userId) {
    return NextResponse.json({ error: "This link is invalid or has expired" }, { status: 400 });
  }

  const passwordHash = await hashPassword(password);
  await prisma.user.update({ where: { id: userId }, data: { passwordHash } });

  return NextResponse.json({ success: true });
}
