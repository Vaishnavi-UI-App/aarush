import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { getServerSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { canManageUsers } from "@/lib/permissions";
import EmployeeProfileForm from "./EmployeeProfileForm";

export default async function EmployeeProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession();
  if (!(await canManageUsers(session!.tenantId, session!.roleId))) redirect("/dashboard");

  const { id } = await params;

  const [user, roles, sites] = await Promise.all([
    prisma.user.findFirst({
      where: { id, tenantId: session!.tenantId },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        photoData: true,
        roleId: true,
        roleRef: { select: { name: true } },
        siteId: true,
        aadharNumber: true,
        panNumber: true,
        bankAccountName: true,
        bankAccountNo: true,
        bankIfsc: true,
        bankName: true,
        monthlySalary: true,
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

  if (!user) notFound();

  return (
    <div>
      <div className="afs-page-header">
        <div>
          <h1 className="afs-page-title">{user.name || user.email}</h1>
          <p className="afs-page-subtitle">Employee profile &mdash; {user.roleRef?.name ?? "No role"}</p>
        </div>
        <div className="afs-page-header-actions">
          <Link href="/settings/users" className="afs-btn" style={{ background: "#e5e7eb", color: "#333" }}>
            &larr; Back to Users
          </Link>
        </div>
      </div>

      <EmployeeProfileForm
        user={{
          id: user.id,
          name: user.name,
          email: user.email,
          phone: user.phone,
          photoData: user.photoData,
          roleId: user.roleId,
          siteId: user.siteId,
          aadharNumber: user.aadharNumber,
          panNumber: user.panNumber,
          bankAccountName: user.bankAccountName,
          bankAccountNo: user.bankAccountNo,
          bankIfsc: user.bankIfsc,
          bankName: user.bankName,
          monthlySalary: user.monthlySalary != null ? Number(user.monthlySalary) : null,
          createdAt: user.createdAt.toISOString(),
        }}
        roles={roles}
        sites={sites}
        isSelf={user.id === session!.userId}
      />
    </div>
  );
}
