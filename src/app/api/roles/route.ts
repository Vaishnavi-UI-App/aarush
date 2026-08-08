import { NextRequest, NextResponse } from "next/server";
import { requireSession, SessionError } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { canManageUsers } from "@/lib/permissions";
import { PAGE_KEYS, PageKey } from "@/lib/pages";

interface PermissionInput {
  canView?: boolean;
  canAdd?: boolean;
  canEdit?: boolean;
  canDelete?: boolean;
}

function parsePermissions(body: unknown): Record<PageKey, PermissionInput> {
  const out = {} as Record<PageKey, PermissionInput>;
  const raw = (body && typeof body === "object" ? (body as Record<string, unknown>) : {}) as Record<string, unknown>;
  for (const page of PAGE_KEYS) {
    const cell = raw[page];
    const c = cell && typeof cell === "object" ? (cell as Record<string, unknown>) : {};
    out[page] = {
      canView: !!c.canView,
      canAdd: !!c.canAdd,
      canEdit: !!c.canEdit,
      canDelete: !!c.canDelete,
    };
  }
  return out;
}

export async function GET(request: NextRequest) {
  let session;
  try {
    session = requireSession(request);
  } catch (e) {
    if (e instanceof SessionError) return NextResponse.json({ error: e.message }, { status: 401 });
    throw e;
  }
  if (!(await canManageUsers(session.tenantId, session.roleId))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const roles = await prisma.role.findMany({
    where: { tenantId: session.tenantId },
    include: { permissions: true, _count: { select: { users: true } } },
    orderBy: [{ isSystem: "desc" }, { createdAt: "asc" }],
  });

  const result = roles.map((role) => {
    const permissions = {} as Record<PageKey, PermissionInput>;
    for (const page of PAGE_KEYS) {
      const row = role.permissions.find((p) => p.page === page);
      permissions[page] = {
        canView: role.isOwner || !!row?.canView,
        canAdd: role.isOwner || !!row?.canAdd,
        canEdit: role.isOwner || !!row?.canEdit,
        canDelete: role.isOwner || !!row?.canDelete,
      };
    }
    return {
      id: role.id,
      name: role.name,
      isSystem: role.isSystem,
      isOwner: role.isOwner,
      userCount: role._count.users,
      permissions,
    };
  });

  return NextResponse.json(result);
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
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name) {
    return NextResponse.json({ error: "Role name is required" }, { status: 400 });
  }

  const permissions = parsePermissions(body.permissions);

  try {
    const role = await prisma.role.create({
      data: {
        tenantId: session.tenantId,
        name,
        isSystem: false,
        isOwner: false,
        permissions: {
          create: PAGE_KEYS.map((page) => ({ page, ...permissions[page] })),
        },
      },
    });
    return NextResponse.json(role, { status: 201 });
  } catch {
    return NextResponse.json({ error: "A role with that name already exists" }, { status: 409 });
  }
}
