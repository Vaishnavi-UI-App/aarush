"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { ReactNode } from "react";
import type { PageKey, PagePermissionSet } from "@/lib/pages";

function Icon({ children }: { children: ReactNode }) {
  return (
    <svg
      className="afs-nav-icon"
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

const icons: Record<string, ReactNode> = {
  "/dashboard": (
    <Icon>
      <rect x="3" y="3" width="8" height="8" rx="1.5" />
      <rect x="13" y="3" width="8" height="8" rx="1.5" />
      <rect x="3" y="13" width="8" height="8" rx="1.5" />
      <rect x="13" y="13" width="8" height="8" rx="1.5" />
    </Icon>
  ),
  "/invoices": (
    <Icon>
      <path d="M6 2h9l3 3v17H6z" />
      <path d="M15 2v3h3" />
      <path d="M9 12h6M9 16h6M9 8h3" />
    </Icon>
  ),
  "/delivery-challans": (
    <Icon>
      <rect x="1" y="7" width="13" height="10" rx="1" />
      <path d="M14 10h4l3 3v4h-7z" />
      <circle cx="6" cy="19" r="1.6" />
      <circle cx="17" cy="19" r="1.6" />
    </Icon>
  ),
  "/customers": (
    <Icon>
      <circle cx="9" cy="8" r="3.2" />
      <path d="M3 20c0-3.5 2.7-6 6-6s6 2.5 6 6" />
      <circle cx="17" cy="7" r="2.4" />
      <path d="M15.5 12.3c2.6.4 4.5 2.6 4.5 5.7" />
    </Icon>
  ),
  "/items": (
    <Icon>
      <path d="M12 2l9 5-9 5-9-5 9-5z" />
      <path d="M3 7v10l9 5 9-5V7" />
      <path d="M12 12v10" />
    </Icon>
  ),
  "/purchases": (
    <Icon>
      <circle cx="9" cy="20" r="1.4" />
      <circle cx="18" cy="20" r="1.4" />
      <path d="M2 3h2l2.4 12.4a2 2 0 0 0 2 1.6h8.6a2 2 0 0 0 2-1.6L21 7H6" />
    </Icon>
  ),
  "/vendors": (
    <Icon>
      <path d="M3 21V9l9-5 9 5v12" />
      <path d="M9 21v-6h6v6" />
      <path d="M3 9h18" />
    </Icon>
  ),
  "/banking": (
    <Icon>
      <path d="M3 10l9-6 9 6" />
      <path d="M4 10v9h16v-9" />
      <path d="M9 13v4M12 13v4M15 13v4" />
      <path d="M2 21h20" />
    </Icon>
  ),
  "/reports/ageing": (
    <Icon>
      <path d="M4 20V10M11 20V4M18 20v-7" />
      <path d="M2 20h20" />
    </Icon>
  ),
  "/attendance": (
    <Icon>
      <rect x="3" y="4" width="18" height="17" rx="2" />
      <path d="M3 9h18M8 2v4M16 2v4" />
      <path d="M8.5 14.5l2 2 4-4" />
    </Icon>
  ),
  "/expenses": (
    <Icon>
      <rect x="2" y="6" width="20" height="13" rx="2" />
      <path d="M2 10h20" />
      <circle cx="17" cy="14.5" r="1.6" />
    </Icon>
  ),
  "/sites": (
    <Icon>
      <path d="M12 21s7-6.2 7-11.5A7 7 0 0 0 5 9.5C5 14.8 12 21 12 21z" />
      <circle cx="12" cy="9.5" r="2.4" />
    </Icon>
  ),
  "/track": (
    <Icon>
      <rect x="1" y="7" width="13" height="10" rx="1" />
      <path d="M14 10h4l3 3v4h-7z" />
      <circle cx="6" cy="19" r="1.6" />
      <circle cx="17" cy="19" r="1.6" />
    </Icon>
  ),
  "/payroll": (
    <Icon>
      <rect x="2" y="5" width="20" height="14" rx="2" />
      <circle cx="12" cy="12" r="3" />
      <path d="M6 9v.01M18 15v.01" />
    </Icon>
  ),
  "/settings/users": (
    <Icon>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 13.5a7.6 7.6 0 0 0 0-3l2-1.5-2-3.4-2.3.9a7.6 7.6 0 0 0-2.6-1.5L14 2h-4l-.5 2.5a7.6 7.6 0 0 0-2.6 1.5l-2.3-.9-2 3.4 2 1.5a7.6 7.6 0 0 0 0 3l-2 1.5 2 3.4 2.3-.9c.8.7 1.6 1.2 2.6 1.5L10 22h4l.5-2.5a7.6 7.6 0 0 0 2.6-1.5l2.3.9 2-3.4-2-1.5z" />
    </Icon>
  ),
  "/settings/company": (
    <Icon>
      <path d="M3 21V9l9-5 9 5v12" />
      <path d="M9 21v-6h6v6" />
      <path d="M3 9h18" />
    </Icon>
  ),
};

const links: { href: string; label: string; pages?: PageKey[]; ownerOnly?: boolean }[] = [
  { href: "/dashboard", label: "Dashboard", pages: ["dashboard"] },
  { href: "/invoices", label: "Invoices", pages: ["invoices"] },
  { href: "/delivery-challans", label: "Delivery Challans", pages: ["deliveryChallans"] },
  { href: "/customers", label: "Customers", pages: ["customers"] },
  { href: "/items", label: "Items", pages: ["items"] },
  { href: "/purchases", label: "Purchases", pages: ["purchases"] },
  { href: "/vendors", label: "Vendors", pages: ["vendors"] },
  { href: "/banking", label: "Banking", pages: ["banking"] },
  { href: "/reports/ageing", label: "Ageing Report", pages: ["ageing"] },
  { href: "/attendance", label: "Attendance", pages: ["myAttendance", "allAttendance"] },
  { href: "/expenses", label: "Expenses", pages: ["expenses"] },
  { href: "/payroll", label: "Payroll", ownerOnly: true },
  { href: "/sites", label: "Sites", pages: ["sites"] },
  { href: "/track", label: "Track", pages: ["track"] },
  { href: "/settings/users", label: "Settings", ownerOnly: true },
  { href: "/settings/company", label: "Organization Details", ownerOnly: true },
];

export default function SidebarNav({
  logoUrl,
  tenantName,
  pageAccess,
  manageUsers,
}: {
  logoUrl: string;
  tenantName: string;
  pageAccess: Record<PageKey, PagePermissionSet>;
  manageUsers: boolean;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const visibleLinks = links.filter(
    (link) =>
      (!link.ownerOnly || manageUsers) &&
      (!link.pages || link.pages.some((p) => pageAccess[p]?.canView))
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
              {icons[link.href]}
              <span>{link.label}</span>
            </Link>
          ))}
        </nav>
        <div className="afs-sidebar-footer">
          <Link href="/profile" className={pathname.startsWith("/profile") ? "active" : ""} style={{ display: "block", marginBottom: 10 }}>
            My Profile
          </Link>
          <button onClick={logout} type="button">
            Sign out
          </button>
        </div>
      </aside>
    </>
  );
}
