import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendPasswordSetupEmail } from "@/lib/password-reset";

/** Always responds with a generic success message, whether or not the email exists --
 * confirming/denying account existence here would let an attacker enumerate users. */
export async function POST(request: NextRequest) {
  const { email } = await request.json().catch(() => ({}));
  if (!email || typeof email !== "string") {
    return NextResponse.json({ error: "email is required" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (user) {
    const appBaseUrl = process.env.APP_BASE_URL ?? request.nextUrl.origin;
    await sendPasswordSetupEmail(user, appBaseUrl).catch((e) => {
      console.error("Failed to send password reset email:", e);
    });
  }

  return NextResponse.json({ success: true });
}
