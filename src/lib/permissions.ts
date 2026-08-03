import { prisma } from "@/lib/prisma";
import { PermissionKey, resolveDefault, Role } from "@/lib/permission-keys";

export type { Role, PermissionKey };
export { PERMISSION_KEYS, PERMISSION_LABELS, resolveDefault } from "@/lib/permission-keys";

/** Resolves an effective permission: a RolePermission row overrides the hardcoded
 * default; absence of a row means "use the default". OWNER can never lose
 * canManageUsers, no matter what's in the DB -- otherwise nobody could ever open
 * Settings again to undo a mistaken override. */
async function hasPermission(tenantId: string, role: Role, key: PermissionKey): Promise<boolean> {
  if (role === "OWNER" && key === "canManageUsers") return true;

  const override = await prisma.rolePermission.findUnique({
    where: { tenantId_role_key: { tenantId, role, key } },
  });
  return override ? override.allowed : resolveDefault(role, key);
}

export const canAccessFinance = (tenantId: string, role: Role): Promise<boolean> => hasPermission(tenantId, role, "canAccessFinance");
export const canWrite = (tenantId: string, role: Role): Promise<boolean> => hasPermission(tenantId, role, "canWrite");
export const canManageUsers = (tenantId: string, role: Role): Promise<boolean> => hasPermission(tenantId, role, "canManageUsers");
export const canViewAllAttendance = (tenantId: string, role: Role): Promise<boolean> => hasPermission(tenantId, role, "canViewAllAttendance");
export const canViewTracking = (tenantId: string, role: Role): Promise<boolean> => hasPermission(tenantId, role, "canViewTracking");

/** Whether this role punches in/out at all. Structural (the owner isn't
 * timesheeted by themselves), not an access-control decision -- not configurable. */
export const marksOwnAttendance = (role: Role): boolean => role !== "OWNER";
