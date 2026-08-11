"use client";

import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { createBaseLayers, DEFAULT_BASE_LAYER } from "@/lib/leaflet-layers";

const INDIA_CENTER: [number, number] = [20.5937, 78.9629];

export interface PickedLocation {
  lat: number;
  lng: number;
  radiusM: number;
}

/** Same click/drag-to-pin map as the site detail page's Location & Geofence picker, but
 * with no save button of its own -- it just reports the picked point up via onChange so
 * the New Site form can submit it in the same request that creates the site, instead of
 * requiring a second trip to the site's detail page afterward. */
export default function SiteLocationPickerInline({ onChange }: { onChange: (loc: PickedLocation | null) => void }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const circleRef = useRef<L.Circle | null>(null);

  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);
  const [radiusM, setRadiusM] = useState(150);

  const [searchQuery, setSearchQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = L.map(containerRef.current).setView(INDIA_CENTER, 5);
    mapRef.current = map;
    const baseLayers = createBaseLayers();
    baseLayers[DEFAULT_BASE_LAYER].addTo(map);
    L.control.layers(baseLayers).addTo(map);

    map.on("click", (e: L.LeafletMouseEvent) => {
      setLat(Math.round(e.latlng.lat * 1e6) / 1e6);
      setLng(Math.round(e.latlng.lng * 1e6) / 1e6);
    });

    return () => {
      map.remove();
      mapRef.current = null;
    };
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

    if (lat == null || lng == null) {
      onChange(null);
      return;
    }

    markerRef.current = L.marker([lat, lng], { draggable: true })
      .addTo(map)
      .on("dragend", (e) => {
        const pos = (e.target as L.Marker).getLatLng();
        setLat(Math.round(pos.lat * 1e6) / 1e6);
        setLng(Math.round(pos.lng * 1e6) / 1e6);
      });

    circleRef.current = L.circle([lat, lng], {
      radius: radiusM,
      color: "#2b5cb2",
      fillColor: "#2b5cb2",
      fillOpacity: 0.12,
      weight: 1.5,
    }).addTo(map);

    onChange({ lat, lng, radiusM });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lat, lng, radiusM]);

  async function search() {
    if (!searchQuery.trim()) return;
    setSearching(true);
    setSearchError(null);
    try {
      const res = await fetch(`/api/geocode?q=${encodeURIComponent(searchQuery.trim())}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Search failed");
      setLat(Math.round(data.lat * 1e6) / 1e6);
      setLng(Math.round(data.lng * 1e6) / 1e6);
      mapRef.current?.setView([data.lat, data.lng], 16);
    } catch (e) {
      setSearchError(e instanceof Error ? e.message : "Search failed");
    } finally {
      setSearching(false);
    }
  }

  function clear() {
    setLat(null);
    setLng(null);
  }

  return (
    <div style={{ marginTop: 6, marginBottom: 6 }}>
      <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
        <input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              search();
            }
          }}
          placeholder="Search address or place name"
          style={{ flex: 1 }}
        />
        <button type="button" onClick={search} disabled={searching || !searchQuery.trim()} className="afs-btn" style={{ background: "#e5e7eb", color: "#333" }}>
          {searching ? "Searching…" : "Search"}
        </button>
      </div>
      {searchError && <div style={{ color: "#b91c1c", fontSize: 12.5, marginBottom: 8 }}>{searchError}</div>}
      <div
        ref={containerRef}
        style={{ width: "100%", height: 280, borderRadius: 12, overflow: "hidden", position: "relative", isolation: "isolate", zIndex: 0, marginBottom: 10 }}
      />
      <div className="afs-form-row">
        <div className="afs-form-field">
          <label>Latitude</label>
          <input readOnly value={lat != null ? lat.toFixed(6) : ""} placeholder="Click the map to pin" />
        </div>
        <div className="afs-form-field">
          <label>Longitude</label>
          <input readOnly value={lng != null ? lng.toFixed(6) : ""} placeholder="Click the map to pin" />
        </div>
        <div className="afs-form-field">
          <label>Geofence radius (meters)</label>
          <input type="number" min="10" step="10" value={radiusM} onChange={(e) => setRadiusM(Number(e.target.value) || 0)} />
        </div>
      </div>
      {lat != null && (
        <button type="button" onClick={clear} className="afs-btn" style={{ background: "#e5e7eb", color: "#333", fontSize: 12, padding: "4px 10px" }}>
          Clear pin
        </button>
      )}
    </div>
  );
}
