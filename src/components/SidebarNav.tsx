"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

const links = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/invoices", label: "Invoices" },
  { href: "/delivery-challans", label: "Delivery Challans" },
  { href: "/customers", label: "Customers" },
  { href: "/items", label: "Items" },
  { href: "/purchases", label: "Purchases", financeOnly: true },
  { href: "/vendors", label: "Vendors", financeOnly: true },
  { href: "/banking", label: "Banking", financeOnly: true },
  { href: "/reports/ageing", label: "Ageing Report", financeOnly: true },
  { href: "/attendance", label: "Attendance" },
  { href: "/expenses", label: "Expenses" },
  { href: "/sites", label: "Sites", financeOnly: true },
  { href: "/track", label: "Track", trackingOnly: true },
  { href: "/settings/users", label: "Settings", ownerOnly: true },
  { href: "/settings/permissions", label: "Permissions", ownerOnly: true },
];

export interface SidebarPermissions {
  finance: boolean;
  manageUsers: boolean;
  tracking: boolean;
}

export default function SidebarNav({
  logoUrl,
  tenantName,
  permissions,
}: {
  logoUrl: string;
  tenantName: string;
  permissions: SidebarPermissions;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const visibleLinks = links.filter(
    (link) =>
      (!link.financeOnly || permissions.finance) &&
      (!link.ownerOnly || permissions.manageUsers) &&
      (!link.trackingOnly || permissions.tracking)
  );

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <>
      <button
        type="button"
        className="afs-nav-toggle"
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? "Close menu" : "Open menu"}
        aria-expanded={open}
      >
        <span />
        <span />
        <span />
      </button>

      {open && <div className="afs-nav-backdrop" onClick={() => setOpen(false)} />}

      <aside className={`afs-sidebar${open ? " afs-sidebar-open" : ""}`}>
        <div className="afs-sidebar-brand">
          <img src={logoUrl} alt="logo" />
          <span>{tenantName}</span>
        </div>
        <nav className="afs-nav">
          {visibleLinks.map((link) => (
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
    </>
  );
}
