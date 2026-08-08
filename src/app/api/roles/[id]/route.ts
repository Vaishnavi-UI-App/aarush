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

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  let session;
  try {
    session = requireSession(request);
  } catch (e) {
    if (e instanceof SessionError) return NextResponse.json({ error: e.message }, { status: 401 });
    throw e;
  }
  if (!(await canManageUsers(session.tenantId, session.roleId))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const role = await prisma.role.findFirst({ where: { id, tenantId: session.tenantId } });
  if (!role) {
    return NextResponse.json({ error: "Role not found" }, { status: 404 });
  }
  // The Owner role always has full access, hardcoded -- editing its matrix would be a
  // no-op at best and confusing at worst, so it's blocked outright.
  if (role.isOwner) {
    return NextResponse.json({ error: "The Owner role always has full access and can't be edited" }, { status: 400 });
  }

  const body = await request.json().catch(() => ({}));
  const data: { name?: string } = {};
  if (body.name !== undefined) {
    if (role.isSystem) {
      return NextResponse.json({ error: "Built-in role names can't be changed" }, { status: 400 });
    }
    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (!name) return NextResponse.json({ error: "Role name is required" }, { status: 400 });
    data.name = name;
  }

  try {
    await prisma.$transaction(async (tx) => {
      if (Object.keys(data).length > 0) {
        await tx.role.update({ where: { id }, data });
      }
      if (body.permissions !== undefined) {
        const permissions = parsePermissions(body.permissions);
        for (const page of PAGE_KEYS) {
          await tx.rolePagePermission.upsert({
            where: { roleId_page: { roleId: id, page } },
            create: { roleId: id, page, ...permissions[page] },
            update: permissions[page],
          });
        }
      }
    });
  } catch {
    return NextResponse.json({ error: "A role with that name already exists" }, { status: 409 });
  }

  const updated = await prisma.role.findUniqueOrThrow({ where: { id }, include: { permissions: true } });
  return NextResponse.json(updated);
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  let session;
  try {
    session = requireSession(request);
  } catch (e) {
    if (e instanceof SessionError) return NextResponse.json({ error: e.message }, { status: 401 });
    throw e;
  }
  if (!(await canManageUsers(session.tenantId, session.roleId))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const role = await prisma.role.findFirst({ where: { id, tenantId: session.tenantId }, include: { _count: { select: { users: true } } } });
  if (!role) {
    return NextResponse.json({ error: "Role not found" }, { status: 404 });
  }
  if (role.isSystem) {
    return NextResponse.json({ error: "Built-in roles can't be deleted" }, { status: 400 });
  }
  if (role._count.users > 0) {
    return NextResponse.json({ error: `${role._count.users} user(s) still have this role -- reassign them first` }, { status: 400 });
  }

  await prisma.$transaction([
    prisma.rolePagePermission.deleteMany({ where: { roleId: id } }),
    prisma.role.delete({ where: { id } }),
  ]);

  return NextResponse.json({ success: true });
}
