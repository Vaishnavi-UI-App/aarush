import { NextRequest, NextResponse } from "next/server";
import { requireSession, SessionError } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { canManageUsers } from "@/lib/permissions";
import { generateRandomPassword, hashPassword } from "@/lib/password";
import { sendWelcomeCredentialsEmail } from "@/lib/password-reset";

export async function GET(request: NextRequest) {
  let session;
  try {
    session = requireSession(request);
  } catch (e) {
    if (e instanceof SessionError) return NextResponse.json({ error: e.message }, { status: 401 });
    throw e;
  }
  if (!(await canManageUsers(session.tenantId, session.roleId))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const users = await prisma.user.findMany({
    where: { tenantId: session.tenantId },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      name: true,
      email: true,
      roleId: true,
      roleRef: { select: { name: true } },
      siteId: true,
      site: { select: { name: true } },
      createdAt: true,
    },
  });

  return NextResponse.json(users);
}

export async function POST(request: NextRequest) {
  let session;
  try {
    session = requireSession(request);
  } catch (e) {
    if (e instanceof SessionError) return NextResponse.json({ error: e.message }, { status: 401 });
    throw e;
  }
  if (!(await canManageUsers(session.tenantId, session.roleId))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await request.json().catch(() => ({}));
  const { name, email, roleId, siteId } = body;
  if (!email || typeof email !== "string" || !roleId || typeof roleId !== "string") {
    return NextResponse.json({ error: "email and a valid role are required" }, { status: 400 });
  }
  if (siteId !== undefined && siteId !== null && typeof siteId !== "string") {
    return NextResponse.json({ error: "siteId must be a string or null" }, { status: 400 });
  }

  const role = await prisma.role.findFirst({ where: { id: roleId, tenantId: session.tenantId } });
  if (!role) {
    return NextResponse.json({ error: "That role doesn't exist" }, { status: 400 });
  }
  if (siteId) {
    const site = await prisma.site.findFirst({ where: { id: siteId, tenantId: session.tenantId } });
    if (!site) {
      return NextResponse.json({ error: "That site doesn't exist" }, { status: 400 });
    }
  }

  const generatedPassword = generateRandomPassword();
  const passwordHash = await hashPassword(generatedPassword);

  let user;
  try {
    user = await prisma.user.create({
      data: { tenantId: session.tenantId, name: name || null, email, roleId, siteId: siteId || null, passwordHash },
    });
  } catch {
    return NextResponse.json({ error: "A user with that email already exists" }, { status: 409 });
  }

  const appBaseUrl = process.env.APP_BASE_URL ?? request.nextUrl.origin;
  let emailed = true;
  try {
    await sendWelcomeCredentialsEmail(user, generatedPassword, appBaseUrl);
  } catch (e) {
    console.error("Failed to send welcome email:", e);
    emailed = false;
  }

  return NextResponse.json(
    {
      id: user.id,
      name: user.name,
      email: user.email,
      roleId: user.roleId,
      createdAt: user.createdAt,
      emailed,
      // Only surfaced when the email failed to send -- otherwise the OWNER has no other
      // way to relay it, since the plaintext password is never stored.
      password: emailed ? undefined : generatedPassword,
    },
    { status: 201 }
  );
}
