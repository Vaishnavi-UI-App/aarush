import { redirect } from "next/navigation";
import { getServerSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { canManageUsers, PERMISSION_KEYS, resolveDefault, Role } from "@/lib/permissions";
import PermissionsMatrix from "./PermissionsMatrix";

const ROLES: Role[] = ["OWNER", "ACCOUNTANT", "SALES_STAFF", "AUDITOR"];

export default async function SettingsPermissionsPage() {
  const session = await getServerSession();
  if (!(await canManageUsers(session!.tenantId, session!.role))) redirect("/dashboard");

  const overrides = await prisma.rolePermission.findMany({ where: { tenantId: session!.tenantId } });
  const overrideMap = new Map(overrides.map((o) => [`${o.role}:${o.key}`, o.allowed]));

  const matrix = ROLES.map((role) => ({
    role,
    permissions: PERMISSION_KEYS.map((key) => {
      const override = overrideMap.get(`${role}:${key}`);
      return { key, allowed: override ?? resolveDefault(role, key), isOverride: override !== undefined };
    }),
  }));

  return (
    <div>
      <h1 className="afs-page-title">Settings — Permissions</h1>
      <p className="afs-page-subtitle">Control what each role can access. Changes apply immediately, no re-login needed.</p>

      <div className="afs-card" style={{ marginTop: 20 }}>
        <PermissionsMatrix matrix={matrix} />
      </div>
    </div>
  );
}
