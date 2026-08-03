import { NextRequest, NextResponse } from "next/server";
import { requireSession, SessionError } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { canManageUsers, PERMISSION_KEYS, resolveDefault, Role } from "@/lib/permissions";

const ROLES: Role[] = ["OWNER", "ACCOUNTANT", "SALES_STAFF", "AUDITOR"];

export async function GET(request: NextRequest) {
  let session;
  try {
    session = requireSession(request);
  } catch (e) {
    if (e instanceof SessionError) return NextResponse.json({ error: e.message }, { status: 401 });
    throw e;
  }
  if (!(await canManageUsers(session.tenantId, session.role))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const overrides = await prisma.rolePermission.findMany({ where: { tenantId: session.tenantId } });
  const overrideMap = new Map(overrides.map((o) => [`${o.role}:${o.key}`, o.allowed]));

  const matrix = ROLES.map((role) => ({
    role,
    permissions: PERMISSION_KEYS.map((key) => {
      const override = overrideMap.get(`${role}:${key}`);
      return {
        key,
        allowed: override ?? resolveDefault(role, key),
        isOverride: override !== undefined,
      };
    }),
  }));

  return NextResponse.json(matrix);
}

export async function PATCH(request: NextRequest) {
  let session;
  try {
    session = requireSession(request);
  } catch (e) {
    if (e instanceof SessionError) return NextResponse.json({ error: e.message }, { status: 401 });
    throw e;
  }
  if (!(await canManageUsers(session.tenantId, session.role))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await request.json().catch(() => ({}));
  const { role, key, allowed } = body;
  if (!ROLES.includes(role) || !PERMISSION_KEYS.includes(key)) {
    return NextResponse.json({ error: "A valid role and key are required" }, { status: 400 });
  }
  if (allowed !== null && typeof allowed !== "boolean") {
    return NextResponse.json({ error: "allowed must be a boolean or null" }, { status: 400 });
  }

  // Hard block, independent of the UI's disabled checkbox -- OWNER can never lose
  // Settings/Users access, or nobody could ever undo a mistaken override again.
  if (role === "OWNER" && key === "canManageUsers" && allowed === false) {
    return NextResponse.json({ error: "OWNER can't lose access to manage users" }, { status: 400 });
  }

  if (allowed === null) {
    await prisma.rolePermission.deleteMany({ where: { tenantId: session.tenantId, role, key } });
  } else {
    await prisma.rolePermission.upsert({
      where: { tenantId_role_key: { tenantId: session.tenantId, role, key } },
      create: { tenantId: session.tenantId, role, key, allowed },
      update: { allowed },
    });
  }

  return NextResponse.json({ success: true });
}
