import { NextRequest, NextResponse } from "next/server";
import { requireSession, SessionError } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { canManageUsers } from "@/lib/permissions";
import { generateRandomPassword, hashPassword } from "@/lib/password";
import { sendWelcomeCredentialsEmail } from "@/lib/password-reset";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  let session;
  try {
    session = requireSession(request);
  } catch (e) {
    if (e instanceof SessionError) return NextResponse.json({ error: e.message }, { status: 401 });
    throw e;
  }
  if (!(await canManageUsers(session.tenantId, session.roleId))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const user = await prisma.user.findFirst({ where: { id, tenantId: session.tenantId } });
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  // Resending issues a brand new password, same as initial onboarding -- there's no
  // plaintext copy of the old one to resend, only its hash.
  const generatedPassword = generateRandomPassword();
  await prisma.user.update({ where: { id }, data: { passwordHash: await hashPassword(generatedPassword) } });

  const appBaseUrl = process.env.APP_BASE_URL ?? request.nextUrl.origin;
  try {
    await sendWelcomeCredentialsEmail(user, generatedPassword, appBaseUrl);
  } catch (e) {
    console.error("Failed to resend welcome email:", e);
    return NextResponse.json({ error: "Could not send the email", password: generatedPassword }, { status: 502 });
  }

  return NextResponse.json({ success: true });
}
