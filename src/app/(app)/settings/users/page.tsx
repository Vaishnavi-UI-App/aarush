import { redirect } from "next/navigation";
import { getServerSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { canManageUsers } from "@/lib/permissions";
import NewUserForm from "./NewUserForm";
import UserRow from "./UserRow";

export default async function SettingsUsersPage() {
  const session = await getServerSession();
  if (!(await canManageUsers(session!.tenantId, session!.role))) redirect("/dashboard");

  const users = await prisma.user.findMany({
    where: { tenantId: session!.tenantId },
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true, email: true, role: true, createdAt: true },
  });

  return (
    <div>
      <h1 className="afs-page-title">Settings — Users</h1>
      <p className="afs-page-subtitle">Create staff logins and control what each role can access</p>

      <div className="afs-card" style={{ marginBottom: 20, marginTop: 20 }}>
        <NewUserForm />
      </div>

      <div className="afs-card">
        <table className="afs-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Role</th>
              <th>Added</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <UserRow key={u.id} user={u} isSelf={u.id === session!.userId} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
