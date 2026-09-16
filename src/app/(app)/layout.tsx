import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { getServerSession, SESSION_COOKIE_NAME } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { canManageUsers, getPageAccessMap } from "@/lib/permissions";
import SidebarNav from "@/components/SidebarNav";
import LocationPinger from "@/components/LocationPinger";
import BackButton from "@/components/BackButton";
import "@/app/invoice/invoice-page.css";
import "./app-shell.css";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession();
  if (!session) {
    redirect("/login");
  }

  const [tenant, pageAccess, manageUsers, user] = await Promise.all([
    prisma.tenant.findUnique({ where: { id: session.tenantId } }),
    getPageAccessMap(session.tenantId, session.roleId),
    canManageUsers(session.tenantId, session.roleId),
    // Name and role only -- deliberately not photoData. The sidebar renders on every
    // page, and inlining a base64 photo would add tens of KB to every single response
    // for users who are mostly on phones and mobile data.
    prisma.user.findUnique({
      where: { id: session.userId },
      select: { name: true, email: true, roleRef: { select: { name: true } } },
    }),
  ]);
  if (!tenant) {
    (await cookies()).delete(SESSION_COOKIE_NAME);
    redirect("/login");
  }

  return (
    <div className="afs-shell">
      <LocationPinger isOwner={manageUsers} />
      <SidebarNav
        logoUrl="/logo.jpeg"
        tenantName={tenant.name}
        pageAccess={pageAccess}
        manageUsers={manageUsers}
        userName={user?.name || user?.email || "My account"}
        roleName={user?.roleRef?.name ?? null}
      />
      <main className="afs-main">
        <BackButton />
        {children}
      </main>
    </div>
  );
}
