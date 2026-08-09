"use client";

import { setBackgroundLocationConsent } from "@/lib/background-location";

/** The "prominent disclosure" screen Android/Play Store requires an app to show, in its
 * own words, before it asks the OS for ACCESS_BACKGROUND_LOCATION -- the system
 * permission dialog alone isn't considered adequate disclosure for background location.
 * Shown once per device (see hasBackgroundLocationConsent) to non-owner users who have
 * location sharing turned on and are running the native Android app. */
export default function BackgroundLocationConsent({ onDecide }: { onDecide: (granted: boolean) => void }) {
  function decide(granted: boolean) {
    setBackgroundLocationConsent(granted);
    onDecide(granted);
  }

  return (
    <div className="afs-modal-backdrop">
      <div className="afs-modal">
        <h2>Share location in the background?</h2>
        <p>
          With location sharing on, Aarush Fire Protection Systems can keep updating your position for your manager even
          while the app is closed or your phone is locked -- useful for field staff moving between sites during work
          hours. Android will show a persistent notification the whole time this is active, and you can turn it off
          anytime from the location-sharing toggle.
        </p>
        <p>If you'd rather only share your location while the app is open, choose "Not now" -- nothing changes.</p>
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button type="button" onClick={() => decide(false)} className="afs-btn" style={{ background: "#e5e7eb", color: "#333" }}>
            Not now
          </button>
          <button type="button" onClick={() => decide(true)} className="afs-btn afs-btn-primary">
            Enable background location
          </button>
        </div>
      </div>
    </div>
  );
}
