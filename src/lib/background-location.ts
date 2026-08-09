"use client";

import type { BackgroundGeolocationPlugin } from "@capacitor-community/background-geolocation";

/** Starts/stops the native background-location watcher -- Android only, a no-op on the
 * web (where there's no reliable way to keep tracking once the tab isn't active; see
 * LocationPinger's foreground interval for that case).
 *
 * Callers must get the user's explicit consent first (see BackgroundLocationConsent):
 * Android's ACCESS_BACKGROUND_LOCATION prompt requires the app show its own explanation
 * before the system dialog ("prominent disclosure"), and addWatcher's own
 * requestPermissions flag would otherwise fire that system dialog with zero context.
 *
 * This plugin ships native code + types only, no JS proxy -- registerPlugin() is how
 * every Capacitor plugin's JS side is wired up, but most plugins do it for you from
 * their own index.js. This one expects the app to call it directly (see its README).
 */

const CONSENT_KEY = "afs-bg-location-consent";

let watcherId: string | null = null;

async function postPing(lat: number, lng: number) {
  try {
    await fetch("/api/location-ping", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lat, lng }),
    });
  } catch {
    // Best-effort -- the watcher fires again on the next location update.
  }
}

export function hasBackgroundLocationConsent(): boolean {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(CONSENT_KEY) === "granted";
}

/** Whether the user has ever answered the disclosure screen -- as opposed to
 * hasBackgroundLocationConsent(), which is false for both "never asked" and
 * "declined." Callers use this to avoid re-showing the disclosure to someone who
 * already said no. */
export function hasBackgroundLocationDecision(): boolean {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(CONSENT_KEY) !== null;
}

export function setBackgroundLocationConsent(granted: boolean): void {
  window.localStorage.setItem(CONSENT_KEY, granted ? "granted" : "declined");
}

export async function isNativeAndroid(): Promise<boolean> {
  const { Capacitor } = await import("@capacitor/core");
  return Capacitor.isNativePlatform();
}

async function getPlugin(): Promise<BackgroundGeolocationPlugin> {
  const { registerPlugin } = await import("@capacitor/core");
  return registerPlugin<BackgroundGeolocationPlugin>("BackgroundGeolocation");
}

/** Starts the watcher if it isn't already running. Triggers the OS background-location
 * permission prompt on first call (via requestPermissions), so only call this after
 * BackgroundLocationConsent has been accepted. */
export async function startBackgroundWatcher(): Promise<void> {
  if (watcherId || !(await isNativeAndroid())) return;

  const BackgroundGeolocation = await getPlugin();
  watcherId = await BackgroundGeolocation.addWatcher(
    {
      backgroundTitle: "Location sharing is on",
      backgroundMessage: "Aarush Fire Protection Systems is sharing your location with your manager.",
      requestPermissions: true,
      stale: false,
      distanceFilter: 50,
    },
    (location, error) => {
      if (error || !location) return;
      postPing(location.latitude, location.longitude);
    }
  );
}

export async function stopBackgroundWatcher(): Promise<void> {
  if (!watcherId || !(await isNativeAndroid())) return;
  const BackgroundGeolocation = await getPlugin();
  await BackgroundGeolocation.removeWatcher({ id: watcherId });
  watcherId = null;
}
