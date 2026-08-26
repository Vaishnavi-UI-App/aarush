"use client";

import { useRouter } from "next/navigation";

/** Visible "go back" affordance for every app page, mirroring CapacitorBackButton's
 * hardware-back wiring for the native app -- both just walk browser/WebView history. */
export default function BackButton() {
  const router = useRouter();
  return (
    <button type="button" className="afs-back-btn" onClick={() => router.back()}>
      ← Back
    </button>
  );
}
