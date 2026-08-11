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
  const [checkingPincode, setCheckingPincode] = useState(false);
  const [autoFillingPincode, setAutoFillingPincode] = useState(false);

  function set<K extends keyof typeof form>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function onAddressBlur() {
    if (!form.address.trim() || form.pincode.trim()) return;
    setAutoFillingPincode(true);
    try {
      const res = await fetch(`/api/geocode/pincode-for-address?address=${encodeURIComponent(form.address.trim())}`);
      const data = await res.json();
      if (res.ok && data.pincode) {
        setForm((f) => (f.pincode.trim() ? f : { ...f, pincode: data.pincode }));
        setNotice(`Pincode ${data.pincode} auto-filled from the address -- check it's correct.`);
      }
    } catch {
      // Best-effort auto-fill -- the admin can still type the pincode manually.
    } finally {
      setAutoFillingPincode(false);
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);

    // A dropped pin is the most precise thing the admin can give us, so it overrides the
    // pincode-vs-city cross-check entirely -- there's nothing more authoritative to
    // validate it against.
    if (!pickedLocation && form.address.trim() && form.pincode.trim()) {
      setCheckingPincode(true);
      try {
        const res = await fetch(
          `/api/geocode/validate-pincode?address=${encodeURIComponent(form.address.trim())}&pincode=${encodeURIComponent(form.pincode.trim())}`
        );
        const check = await res.json();
        if (res.ok && check.valid === false) {
          setError(
            `Pincode ${form.pincode.trim()} doesn't look like it belongs to "${form.address.trim()}"` +
              (check.resolvedCity ? ` -- that pincode resolves to ${check.resolvedCity}.` : ".") +
              " Double-check it, or pin the exact location on the map instead."
          );
          setCheckingPincode(false);
          return;
        }
      } catch {
        // Validation service being unreachable shouldn't block adding the site -- fall
        // through and let the pincode-based geocoding on the server do its best.
      } finally {
        setCheckingPincode(false);
      }
    }

    setSaving(true);
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

  const pincodeRequired = !!form.address.trim();

  return (
    <form onSubmit={onSubmit}>
      <div className="afs-form-row">
        <div className="afs-form-field">
          <label>Site name *</label>
          <input required value={form.name} onChange={(e) => set("name", e.target.value)} />
        </div>
        <div className="afs-form-field">
          <label>Address</label>
          <input value={form.address} onChange={(e) => set("address", e.target.value)} onBlur={onAddressBlur} />
        </div>
        <div className="afs-form-field">
          <label>Pincode {pincodeRequired && "*"}</label>
          <input
            required={pincodeRequired}
            value={form.pincode}
            onChange={(e) => set("pincode", e.target.value)}
            placeholder={autoFillingPincode ? "Looking up…" : "e.g. 411017"}
            maxLength={10}
            title="Must match the city in the address -- used to place this site on the map"
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
      <button type="submit" disabled={saving || checkingPincode} className="afs-btn afs-btn-primary">
        {checkingPincode ? "Checking pincode…" : saving ? "Adding…" : "+ Add Site"}
      </button>
    </form>
  );
}
