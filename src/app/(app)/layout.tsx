import { redirect } from "next/navigation";
import { getServerSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import SidebarNav from "@/components/SidebarNav";
import "@/app/invoice/invoice-page.css";
import "./app-shell.css";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession();
  if (!session) {
    redirect("/login");
  }

  const tenant = await prisma.tenant.findUniqueOrThrow({ where: { id: session.tenantId } });

  return (
    <div className="afs-shell">
      <SidebarNav logoUrl="/logo.jpeg" tenantName={tenant.name} />
      <main className="afs-main">{children}</main>
    </div>
  );
}
