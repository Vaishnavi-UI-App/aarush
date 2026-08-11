"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import type { PickedLocation } from "./SiteLocationPickerInline";

// Leaflet touches `window` at module load time, so it can't be server-rendered. This
// dynamic import (ssr: false) is legal here because NewSiteForm is itself a Client
// Component -- unlike the site detail page's map, which needs a separate wrapper because
// its parent page.tsx is a Server Component.
const SiteLocationPickerInline = dynamic(() => import("./SiteLocationPickerInline"), {
  ssr: false,
  loading: () => <div className="afs-empty">Loading map…</div>,
});

export default function NewSiteForm() {
  const router = useRouter();
  const [form, setForm] = useState({ name: "", address: "", pincode: "" });
  const [showMap, setShowMap] = useState(false);
  const [pickedLocation, setPickedLocation] = useState<PickedLocation | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function set<K extends keyof typeof form>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch("/api/sites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          ...(pickedLocation
            ? { latitude: pickedLocation.lat, longitude: pickedLocation.lng, geofenceRadiusM: pickedLocation.radiusM }
            : {}),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create site");
      if (pickedLocation) {
        setNotice("Site added and located on the map from the pin you dropped.");
      } else if (form.pincode && data.geocodeFailed) {
        setNotice("Site added, but that pincode couldn't be located on the map -- set its location manually from the site page.");
      } else if (form.pincode) {
        setNotice("Site added and located on the map from its pincode.");
      }
      setForm({ name: "", address: "", pincode: "" });
      setPickedLocation(null);
      setShowMap(false);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create site");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={onSubmit}>
      <div className="afs-form-row">
        <div className="afs-form-field">
          <label>Site name *</label>
          <input required value={form.name} onChange={(e) => set("name", e.target.value)} />
        </div>
        <div className="afs-form-field">
          <label>Address</label>
          <input value={form.address} onChange={(e) => set("address", e.target.value)} />
        </div>
        <div className="afs-form-field">
          <label>Pincode</label>
          <input
            value={form.pincode}
            onChange={(e) => set("pincode", e.target.value)}
            placeholder="e.g. 411017"
            maxLength={10}
            title="Used to automatically place this site on the map"
          />
        </div>
      </div>

      <button
        type="button"
        onClick={() => setShowMap((v) => !v)}
        className="afs-btn"
        style={{ background: "#e5e7eb", color: "#333", marginBottom: showMap ? 10 : 16, fontSize: 13 }}
      >
        {showMap ? "Hide map" : pickedLocation ? "📍 Location pinned -- edit on map" : "📍 Pin exact location on map (optional)"}
      </button>

      {showMap && (
        <div className="afs-card" style={{ background: "#f8f9fd", marginBottom: 16 }}>
          <p style={{ fontSize: 13, color: "#556", marginBottom: 10 }}>
            Search or click the map to drop a pin -- this takes priority over the pincode above once set. Leave it alone and the
            pincode (if any) will locate the site automatically instead.
          </p>
          <SiteLocationPickerInline onChange={setPickedLocation} />
        </div>
      )}

      {error && <div style={{ color: "#b91c1c", fontSize: 13, marginBottom: 10 }}>{error}</div>}
      {notice && !error && <div style={{ color: "#14532d", fontSize: 13, marginBottom: 10 }}>{notice}</div>}
      <button type="submit" disabled={saving} className="afs-btn afs-btn-primary">
        {saving ? "Adding…" : "+ Add Site"}
      </button>
    </form>
  );
}
