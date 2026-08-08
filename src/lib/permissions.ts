import { prisma } from "@/lib/prisma";
import { FULL_ACCESS, NO_ACCESS, PAGE_KEYS, PageKey, PagePermissionSet, PermissionAction } from "@/lib/pages";

export type { PageKey, PermissionAction, PagePermissionSet };
export { PAGE_KEYS, PAGE_LABELS } from "@/lib/pages";

/** True only for the tenant's seeded Owner role -- always has full access to every
 * page and can always manage users/roles, regardless of what's stored in
 * RolePagePermission. Hardcoded so a bad edit (or a freshly created role with no
 * rows yet) can never lock every owner out of their own tenant. */
async function isOwnerRole(tenantId: string, roleId: string | undefined | null): Promise<boolean> {
  if (!roleId) return false;
  const role = await prisma.role.findFirst({ where: { id: roleId, tenantId }, select: { isOwner: true } });
  return !!role?.isOwner;
}

/** Resolves whether roleId can perform `action` on `page`. Fails closed: no roleId,
 * a role from another tenant, or no permission row for that page all mean "no
 * access" -- there's no implicit default the way the old RolePermission table had. */
export async function can(
  tenantId: string,
  roleId: string | undefined | null,
  page: PageKey,
  action: PermissionAction
): Promise<boolean> {
  if (!roleId) return false;

  const role = await prisma.role.findFirst({
    where: { id: roleId, tenantId },
    include: { permissions: { where: { page } } },
  });
  if (!role) return false;
  if (role.isOwner) return true;

  const perm = role.permissions[0];
  if (!perm) return false;
  switch (action) {
    case "view":
      return perm.canView;
    case "add":
      return perm.canAdd;
    case "edit":
      return perm.canEdit;
    case "delete":
      return perm.canDelete;
  }
}

/** Every page's full permission set for this role in one query -- for the sidebar,
 * the app layout, and the permissions settings screen, all of which need the whole
 * matrix at once rather than one page at a time. */
export async function getPageAccessMap(
  tenantId: string,
  roleId: string | undefined | null
): Promise<Record<PageKey, PagePermissionSet>> {
  const map = Object.fromEntries(PAGE_KEYS.map((p) => [p, NO_ACCESS])) as Record<PageKey, PagePermissionSet>;
  if (!roleId) return map;

  const role = await prisma.role.findFirst({ where: { id: roleId, tenantId }, include: { permissions: true } });
  if (!role) return map;
  if (role.isOwner) {
    return Object.fromEntries(PAGE_KEYS.map((p) => [p, FULL_ACCESS])) as Record<PageKey, PagePermissionSet>;
  }

  for (const perm of role.permissions) {
    if (PAGE_KEYS.includes(perm.page as PageKey)) {
      map[perm.page as PageKey] = { canView: perm.canView, canAdd: perm.canAdd, canEdit: perm.canEdit, canDelete: perm.canDelete };
    }
  }
  return map;
}

/** Managing users and roles is Owner-only, full stop -- deliberately not part of
 * the per-page matrix, so a role can never grant itself more power by checking
 * its own boxes in the Permissions screen. */
export const canManageUsers = (tenantId: string, roleId: string | undefined | null): Promise<boolean> => isOwnerRole(tenantId, roleId);

/** Whether this role punches in/out at all. Structural (the owner isn't
 * timesheeted by themselves), not an access-control decision -- not configurable. */
export const marksOwnAttendance = (tenantId: string, roleId: string | undefined | null): Promise<boolean> =>
  isOwnerRole(tenantId, roleId).then((owner) => !owner);
