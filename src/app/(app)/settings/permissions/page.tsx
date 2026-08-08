import { redirect } from "next/navigation";
import { getServerSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { canManageUsers, PAGE_KEYS } from "@/lib/permissions";
import { PageKey, PagePermissionSet } from "@/lib/pages";
import RolesManager from "./RolesManager";

export default async function SettingsPermissionsPage() {
  const session = await getServerSession();
  if (!(await canManageUsers(session!.tenantId, session!.roleId))) redirect("/dashboard");

  const roles = await prisma.role.findMany({
    where: { tenantId: session!.tenantId },
    include: { permissions: true, _count: { select: { users: true } } },
    orderBy: [{ isSystem: "desc" }, { createdAt: "asc" }],
  });

  const rolesForClient = roles.map((role) => {
    const permissions = Object.fromEntries(
      PAGE_KEYS.map((page) => {
        const row = role.permissions.find((p) => p.page === page);
        return [
          page,
          {
            canView: role.isOwner || !!row?.canView,
            canAdd: role.isOwner || !!row?.canAdd,
            canEdit: role.isOwner || !!row?.canEdit,
            canDelete: role.isOwner || !!row?.canDelete,
          },
        ];
      })
    ) as Record<PageKey, PagePermissionSet>;
    return {
      id: role.id,
      name: role.name,
      isSystem: role.isSystem,
      isOwner: role.isOwner,
      userCount: role._count.users,
      permissions,
    };
  });

  return (
    <div>
      <h1 className="afs-page-title">Settings — Permissions</h1>
      <p className="afs-page-subtitle">Create roles and control exactly which pages each one can view, add to, edit, or delete from.</p>

      <div className="afs-card" style={{ marginTop: 20 }}>
        <RolesManager roles={rolesForClient} />
      </div>
    </div>
  );
}
