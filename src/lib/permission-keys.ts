// Pure types/constants only -- no server-only imports (prisma etc.) here, so this file
// is safe to import from client components. src/lib/permissions.ts has the actual
// DB-backed permission checks and imports prisma, so it can only be used server-side.

export type Role = "OWNER" | "ACCOUNTANT" | "SALES_STAFF" | "AUDITOR";

export type PermissionKey = "canAccessFinance" | "canWrite" | "canManageUsers" | "canViewAllAttendance" | "canViewTracking";

export const PERMISSION_KEYS: PermissionKey[] = [
  "canAccessFinance",
  "canWrite",
  "canManageUsers",
  "canViewAllAttendance",
  "canViewTracking",
];

export const PERMISSION_LABELS: Record<PermissionKey, string> = {
  canAccessFinance: "Access Purchases / Vendors / Banking / Ageing / Sites",
  canWrite: "Create & edit records (AUDITOR is view-only when off)",
  canManageUsers: "Manage users & permissions (Settings)",
  canViewAllAttendance: "View everyone's attendance",
  canViewTracking: "View live location tracking",
};

const DEFAULTS: Record<PermissionKey, Role[]> = {
  canAccessFinance: ["OWNER", "ACCOUNTANT", "AUDITOR"],
  canWrite: ["OWNER", "ACCOUNTANT", "SALES_STAFF"],
  canManageUsers: ["OWNER"],
  canViewAllAttendance: ["OWNER"],
  canViewTracking: ["OWNER"],
};

export function resolveDefault(role: Role, key: PermissionKey): boolean {
  return DEFAULTS[key].includes(role);
}
