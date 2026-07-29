"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

const links = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/invoices", label: "Invoices" },
  { href: "/customers", label: "Customers" },
  { href: "/items", label: "Items" },
  { href: "/purchases", label: "Purchases" },
  { href: "/vendors", label: "Vendors" },
  { href: "/banking", label: "Banking" },
  { href: "/reports/ageing", label: "Ageing Report" },
];

export default function SidebarNav({ logoUrl, tenantName }: { logoUrl: string; tenantName: string }) {
  const pathname = usePathname();
  const router = useRouter();

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <aside className="afs-sidebar">
      <div className="afs-sidebar-brand">
        <img src={logoUrl} alt="logo" />
        <span>{tenantName}</span>
      </div>
      <nav className="afs-nav">
        {links.map((link) => (
          <Link key={link.href} href={link.href} className={pathname.startsWith(link.href) ? "active" : ""}>
            {link.label}
          </Link>
        ))}
      </nav>
      <div className="afs-sidebar-footer">
        <button onClick={logout} type="button">
          Sign out
        </button>
      </div>
    </aside>
  );
}
