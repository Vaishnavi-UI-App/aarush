"use client";

import { useEffect } from "react";
import { getLocation } from "@/lib/capture";
import { Role } from "@/lib/permission-keys";

const PING_INTERVAL_MS = 3 * 60 * 1000;

async function pingOnce() {
  try {
    const { lat, lng } = await getLocation();
    await fetch("/api/location-ping", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lat, lng }),
    });
  } catch {
    // Permission denied, unsupported, or a transient network failure -- fail silently,
    // no retry loop and no user-facing noise. Tries again on the next interval tick
    // (or next page load, since the effect re-mounts once per layout mount).
  }
}

/** Renders nothing. While mounted for a non-OWNER role, pings the current location once
 * immediately and then every PING_INTERVAL_MS as long as the app stays open in the
 * foreground -- there's no reliable way to keep a plain web app's geolocation updating
 * once the tab isn't active, so this deliberately doesn't try. */
export default function LocationPinger({ role }: { role: Role }) {
  useEffect(() => {
    if (role === "OWNER") return;

    pingOnce();
    const interval = setInterval(pingOnce, PING_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [role]);

  return null;
}
