import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { canManageUsers } from "@/lib/permissions";
import NewUserForm from "./NewUserForm";
import UserRow from "./UserRow";

export default async function SettingsUsersPage() {
  const session = await getServerSession();
  if (!(await canManageUsers(session!.tenantId, session!.roleId))) redirect("/dashboard");

  const [users, roles, sites] = await Promise.all([
    prisma.user.findMany({
      where: { tenantId: session!.tenantId, archivedAt: null },
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
    }),
    prisma.role.findMany({
      where: { tenantId: session!.tenantId },
      orderBy: [{ isSystem: "desc" }, { createdAt: "asc" }],
      select: { id: true, name: true },
    }),
    prisma.site.findMany({
      where: { tenantId: session!.tenantId, archivedAt: null },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  return (
    <div>
      <div className="afs-page-header">
        <div>
          <h1 className="afs-page-title">Settings — Users</h1>
          <p className="afs-page-subtitle">Create staff logins and control what each role can access</p>
        </div>
        <div className="afs-page-header-actions">
          <Link href="/settings/permissions" className="afs-btn afs-btn-primary">
            Manage Permissions
          </Link>
        </div>
      </div>

      <div className="afs-card" style={{ marginBottom: 20, marginTop: 20 }}>
        <NewUserForm roles={roles} sites={sites} />
      </div>

      <div className="afs-card">
        <table className="afs-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Role</th>
              <th>Site</th>
              <th>Added</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <UserRow
                key={u.id}
                user={{
                  id: u.id,
                  name: u.name,
                  email: u.email,
                  roleId: u.roleId,
                  roleName: u.roleRef?.name ?? "—",
                  siteId: u.siteId,
                  createdAt: u.createdAt,
                }}
                roles={roles}
                sites={sites}
                isSelf={u.id === session!.userId}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
