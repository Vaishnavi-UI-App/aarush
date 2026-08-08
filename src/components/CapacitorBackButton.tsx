"use client";

import { useEffect } from "react";

/** Wires the Android hardware/gesture back button to the WebView's own history --
 * Capacitor doesn't do this automatically. Without it, back does nothing on any
 * page in the native app. Goes back if there's WebView history to go back to,
 * otherwise exits the app instead of getting stuck. No-op on the web (only loads
 * the native plugins when actually running inside Capacitor). */
export default function CapacitorBackButton() {
  useEffect(() => {
    let remove: (() => void) | undefined;
    let cancelled = false;

    (async () => {
      const { Capacitor } = await import("@capacitor/core");
      if (!Capacitor.isNativePlatform()) return;

      const { App } = await import("@capacitor/app");
      const handle = await App.addListener("backButton", ({ canGoBack }) => {
        if (canGoBack) {
          window.history.back();
        } else {
          App.exitApp();
        }
      });
      if (cancelled) {
        handle.remove();
      } else {
        remove = () => handle.remove();
      }
    })();

    return () => {
      cancelled = true;
      remove?.();
    };
  }, []);

  return null;
}
