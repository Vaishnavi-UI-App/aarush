import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { getServerSession, SESSION_COOKIE_NAME } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { canAccessFinance, canManageUsers, canViewTracking } from "@/lib/permissions";
import SidebarNav from "@/components/SidebarNav";
import LocationPinger from "@/components/LocationPinger";
import "@/app/invoice/invoice-page.css";
import "./app-shell.css";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession();
  if (!session) {
    redirect("/login");
  }

  const tenant = await prisma.tenant.findUnique({ where: { id: session.tenantId } });
  if (!tenant) {
    (await cookies()).delete(SESSION_COOKIE_NAME);
    redirect("/login");
  }

  const [finance, manageUsers, tracking] = await Promise.all([
    canAccessFinance(session.tenantId, session.role),
    canManageUsers(session.tenantId, session.role),
    canViewTracking(session.tenantId, session.role),
  ]);

  return (
    <div className="afs-shell">
      <LocationPinger role={session.role} />
      <SidebarNav logoUrl="/logo.jpeg" tenantName={tenant.name} permissions={{ finance, manageUsers, tracking }} />
      <main className="afs-main">{children}</main>
    </div>
  );
}
