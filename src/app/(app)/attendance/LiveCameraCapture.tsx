"use client";

import { useEffect, useRef, useState } from "react";
import { captureVideoFrameToDataUrl } from "@/lib/capture";
import { CameraIcon } from "@/components/icons";

/**
 * Attendance photos exist to prove someone was physically present -- a plain
 * `<input type="file" capture>` doesn't guarantee that: most mobile browsers (and every
 * desktop browser) show it as an ordinary file picker with a "choose from gallery" option
 * right next to "camera", so anyone can just re-upload an old photo. This opens the device
 * camera directly via getUserMedia and only ever hands back a frame grabbed from the live
 * stream, so there's no path to submit a photo that wasn't taken at that moment.
 */
export default function LiveCameraCapture({ onCapture, onCancel }: { onCapture: (dataUrl: string) => void; onCancel: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function start() {
      if (!navigator.mediaDevices?.getUserMedia) {
        setError("Your browser doesn't support camera access. Please use a modern browser to check in.");
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" }, audio: false });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
        setReady(true);
      } catch {
        if (!cancelled) setError("Couldn't access the camera. Please allow camera access and try again.");
      }
    }
    start();

    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, []);

  function stopAndClose(after: () => void) {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    after();
  }

  function capture() {
    if (!videoRef.current) return;
    const dataUrl = captureVideoFrameToDataUrl(videoRef.current);
    stopAndClose(() => onCapture(dataUrl));
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(10, 15, 30, 0.85)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1200,
        padding: 16,
      }}
    >
      <div style={{ width: "100%", maxWidth: 480, background: "#0d1526", borderRadius: 14, overflow: "hidden" }}>
        <div style={{ position: "relative", aspectRatio: "4 / 3", background: "#000" }}>
          <video
            ref={videoRef}
            playsInline
            muted
            style={{ width: "100%", height: "100%", objectFit: "cover", transform: "scaleX(-1)" }}
          />
          {error && (
            <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", padding: 20, textAlign: "center", color: "#fca5a5", fontSize: 13.5 }}>
              {error}
            </div>
          )}
        </div>
        <div style={{ display: "flex", gap: 10, padding: 14 }}>
          <button
            type="button"
            onClick={() => stopAndClose(onCancel)}
            className="afs-btn"
            style={{ flex: 1, background: "#e5e7eb", color: "#333", justifyContent: "center" }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={capture}
            disabled={!ready || !!error}
            className="afs-btn afs-btn-primary"
            style={{ flex: 2, justifyContent: "center" }}
          >
            <CameraIcon /> Capture Photo
          </button>
        </div>
      </div>
    </div>
  );
}
