"use client";

import { usePathname, useRouter } from "next/navigation";

/** Visible "go back" affordance for every app page except the dashboard (the app's
 * home page -- there's nothing upstream of it worth going back to), mirroring
 * CapacitorBackButton's hardware-back wiring for the native app -- both just walk
 * browser/WebView history. */
export default function BackButton() {
  const router = useRouter();
  const pathname = usePathname();
  if (pathname === "/dashboard") return null;
  return (
    <button type="button" className="afs-back-btn" onClick={() => router.back()}>
      ← Back
    </button>
  );
}
