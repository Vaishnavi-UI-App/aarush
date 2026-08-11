"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { createBaseLayers, DEFAULT_BASE_LAYER } from "@/lib/leaflet-layers";

const INDIA_CENTER: [number, number] = [20.5937, 78.9629];

export default function SiteLocationMap({
  siteId,
  initialLat,
  initialLng,
  initialRadiusM,
}: {
  siteId: string;
  initialLat: number | null;
  initialLng: number | null;
  initialRadiusM: number | null;
}) {
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const circleRef = useRef<L.Circle | null>(null);

  const [lat, setLat] = useState<number | null>(initialLat);
  const [lng, setLng] = useState<number | null>(initialLng);
  const [radiusM, setRadiusM] = useState(initialRadiusM ?? 100);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const startCenter: [number, number] = initialLat != null && initialLng != null ? [initialLat, initialLng] : INDIA_CENTER;
    const map = L.map(containerRef.current).setView(startCenter, initialLat != null ? 16 : 5);
    mapRef.current = map;
    const baseLayers = createBaseLayers();
    baseLayers[DEFAULT_BASE_LAYER].addTo(map);
    L.control.layers(baseLayers).addTo(map);

    map.on("click", (e: L.LeafletMouseEvent) => {
      setLat(Math.round(e.latlng.lat * 1e6) / 1e6);
      setLng(Math.round(e.latlng.lng * 1e6) / 1e6);
      setSaved(false);
    });

    return () => {
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (markerRef.current) {
      markerRef.current.remove();
      markerRef.current = null;
    }
    if (circleRef.current) {
      circleRef.current.remove();
      circleRef.current = null;
    }

    if (lat == null || lng == null) return;

    markerRef.current = L.marker([lat, lng], { draggable: true })
      .addTo(map)
      .on("dragend", (e) => {
        const pos = (e.target as L.Marker).getLatLng();
        setLat(Math.round(pos.lat * 1e6) / 1e6);
        setLng(Math.round(pos.lng * 1e6) / 1e6);
        setSaved(false);
      });

    circleRef.current = L.circle([lat, lng], {
      radius: radiusM,
      color: "#2b5cb2",
      fillColor: "#2b5cb2",
      fillOpacity: 0.12,
      weight: 1.5,
    }).addTo(map);
  }, [lat, lng, radiusM]);

  async function save() {
    if (lat == null || lng == null) {
      setError("Click the map (or drag the pin) to set a location first");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/sites/${siteId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ latitude: lat, longitude: lng, geofenceRadiusM: radiusM }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save location");
      setSaved(true);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save location");
    } finally {
      setSaving(false);
    }
  }

  async function clearLocation() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/sites/${siteId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ latitude: null, longitude: null, geofenceRadiusM: null }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to clear location");
      setLat(null);
      setLng(null);
      setSaved(true);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to clear location");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <p style={{ fontSize: 13, color: "#556", marginBottom: 10 }}>
        Click anywhere on the map (or drag the pin) to set this site&apos;s location. The shaded circle is the attendance geofence --
        check-ins from outside it get flagged.
      </p>
      <div
        ref={containerRef}
        style={{ width: "100%", height: 360, borderRadius: 12, overflow: "hidden", position: "relative", isolation: "isolate", zIndex: 0, marginBottom: 12 }}
      />
      <div className="afs-form-row">
        <div className="afs-form-field">
          <label>Latitude</label>
          <input readOnly value={lat != null ? lat.toFixed(6) : ""} placeholder="Click the map" />
        </div>
        <div className="afs-form-field">
          <label>Longitude</label>
          <input readOnly value={lng != null ? lng.toFixed(6) : ""} placeholder="Click the map" />
        </div>
        <div className="afs-form-field">
          <label>Geofence radius (meters)</label>
          <input type="number" min="10" step="10" value={radiusM} onChange={(e) => setRadiusM(Number(e.target.value) || 0)} />
        </div>
      </div>
      {error && <div style={{ color: "#b91c1c", fontSize: 13, marginBottom: 10 }}>{error}</div>}
      {saved && !error && <div style={{ color: "#14532d", fontSize: 13, marginBottom: 10 }}>Saved.</div>}
      <div style={{ display: "flex", gap: 10 }}>
        <button type="button" onClick={save} disabled={saving} className="afs-btn afs-btn-primary">
          {saving ? "Saving…" : "Save Location"}
        </button>
        {initialLat != null && (
          <button type="button" onClick={clearLocation} disabled={saving} className="afs-btn" style={{ background: "#e5e7eb", color: "#333" }}>
            Clear Location
          </button>
        )}
      </div>
    </div>
  );
}
