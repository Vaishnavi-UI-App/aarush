"use client";

import { useEffect, useState } from "react";
import { getLocation } from "@/lib/capture";
import {
  hasBackgroundLocationConsent,
  hasBackgroundLocationDecision,
  isNativeAndroid,
  startBackgroundWatcher,
  stopBackgroundWatcher,
} from "@/lib/background-location";
import BackgroundLocationConsent from "@/components/BackgroundLocationConsent";

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

/** Renders a persistent, visible on/off indicator for location sharing while mounted
 * for a non-owner user (Android/foreground-service equivalents don't apply to a plain
 * web app, but the same "the user must always be able to see and stop it" principle
 * does) -- and pings the current location once immediately, then every
 * PING_INTERVAL_MS, for as long as both the app stays open in the foreground and
 * sharing is turned on. There's no reliable way to keep a plain web app's geolocation
 * updating once the tab isn't active, so this deliberately doesn't try. */
export default function LocationPinger({ isOwner }: { isOwner: boolean }) {
  const [sharingEnabled, setSharingEnabled] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [showConsent, setShowConsent] = useState(false);

  useEffect(() => {
    if (isOwner) return;
    fetch("/api/location-ping/toggle")
      .then((res) => res.json())
      .then((d) => setSharingEnabled(!!d.sharingEnabled))
      .catch(() => setSharingEnabled(true));
  }, [isOwner]);

  useEffect(() => {
    if (isOwner || !sharingEnabled) return;
    pingOnce();
    const interval = setInterval(pingOnce, PING_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [isOwner, sharingEnabled]);

  // Background coverage (Android only): once sharing is on, either resume the
  // background watcher (consent already given on this device) or ask for consent
  // first -- Play Store requires the app's own explanation before the OS permission
  // prompt. Turning sharing off, or leaving the app, always stops the watcher.
  useEffect(() => {
    if (isOwner || sharingEnabled === null) return;
    if (!sharingEnabled) {
      stopBackgroundWatcher();
      return;
    }

    let cancelled = false;
    (async () => {
      if (!(await isNativeAndroid()) || cancelled) return;
      if (hasBackgroundLocationConsent()) {
        startBackgroundWatcher();
      } else if (!hasBackgroundLocationDecision()) {
        setShowConsent(true);
      }
    })();

    return () => {
      cancelled = true;
      stopBackgroundWatcher();
    };
  }, [isOwner, sharingEnabled]);

  async function toggle() {
    if (sharingEnabled === null) return;
    const next = !sharingEnabled;
    setBusy(true);
    try {
      await fetch("/api/location-ping/toggle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: next }),
      });
      setSharingEnabled(next);
    } finally {
      setBusy(false);
    }
  }

  if (isOwner || sharingEnabled === null) return null;

  return (
    <>
      {showConsent && (
        <BackgroundLocationConsent
          onDecide={(granted) => {
            setShowConsent(false);
            if (granted) startBackgroundWatcher();
          }}
        />
      )}
      <button
        type="button"
        onClick={toggle}
        disabled={busy}
        title={sharingEnabled ? "Location sharing is on -- click to turn off" : "Location sharing is off -- click to turn on"}
        style={{
          position: "fixed",
          right: 16,
          bottom: 16,
          zIndex: 500,
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          padding: "7px 14px",
          borderRadius: 999,
          border: "none",
          fontSize: 12,
          fontWeight: 700,
          cursor: "pointer",
          boxShadow: "0 4px 14px rgba(13,31,61,0.25)",
          background: sharingEnabled ? "#189a4b" : "#6b7280",
          color: "#fff",
        }}
      >
        <span
          style={{
            width: 8,
            height: 8,
            borderRadius: "50%",
            background: "#fff",
            opacity: sharingEnabled ? 1 : 0.6,
            animation: sharingEnabled ? "afs-pulse 1.6s ease-in-out infinite" : "none",
          }}
        />
        {sharingEnabled ? "Location sharing on" : "Location sharing off"}
        <style>{`@keyframes afs-pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.35; } }`}</style>
      </button>
    </>
  );
}
