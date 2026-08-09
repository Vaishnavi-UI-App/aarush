/** Client-only helpers for attendance check-in/out: GPS position and a compressed photo. */

import { Geolocation } from "@capacitor/geolocation";

/** Uses the Capacitor Geolocation plugin, which calls through to the native Android
 * location APIs when running inside the Capacitor shell (more reliable than the browser
 * API in a WebView) and transparently falls back to navigator.geolocation when running
 * as a plain web page -- same call site works in both. */
export async function getLocation(): Promise<{ lat: number; lng: number }> {
  try {
    const pos = await Geolocation.getCurrentPosition({ enableHighAccuracy: true, timeout: 15000 });
    return { lat: pos.coords.latitude, lng: pos.coords.longitude };
  } catch (err) {
    throw new Error(err instanceof Error ? err.message : "Could not get your location");
  }
}

const MAX_WIDTH = 640;
const JPEG_QUALITY = 0.6;

/** Downscales a captured photo to keep the base64 payload small before it goes in the DB. */
export function resizePhotoToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);
    img.onload = () => {
      const scale = Math.min(1, MAX_WIDTH / img.width);
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        URL.revokeObjectURL(objectUrl);
        reject(new Error("Could not process the photo"));
        return;
      }
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(objectUrl);
      resolve(canvas.toDataURL("image/jpeg", JPEG_QUALITY));
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Could not read the photo"));
    };
    img.src = objectUrl;
  });
}

/** Snapshots the current frame of a live <video> stream (from getUserMedia) into a
 * downscaled JPEG data URL -- same size/quality target as resizePhotoToDataUrl, so a
 * live camera capture and a file-picker capture produce comparably sized payloads. */
export function captureVideoFrameToDataUrl(video: HTMLVideoElement): string {
  const scale = Math.min(1, MAX_WIDTH / video.videoWidth);
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(video.videoWidth * scale);
  canvas.height = Math.round(video.videoHeight * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not process the photo");
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", JPEG_QUALITY);
}

/** Renders a timestamp as "just now" / "Xm ago" / "Xh ago" for freshness indicators. */
export function formatRelative(date: Date): string {
  const seconds = Math.max(0, (Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ago`;
}
