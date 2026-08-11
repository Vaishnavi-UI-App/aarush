"use client";

import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "@/lib/leaflet-labels.css";
import { createBaseLayers, DEFAULT_BASE_LAYER } from "@/lib/leaflet-layers";
import { haversineDistanceMeters } from "@/lib/geo";

export interface StaffPoint {
  id: string;
  name: string;
  lat: number;
  lng: number;
  tier: "fresh" | "stale" | "offline";
}

export interface SitePoint {
  id: string;
  name: string;
  lat: number;
  lng: number;
}

const TIER_COLOR: Record<StaffPoint["tier"], string> = { fresh: "#189a4b", stale: "#c9860e", offline: "#9aa2b1" };
const INDIA_CENTER: [number, number] = [20.5937, 78.9629];

/** A point on the map the admin can tap to measure distance -- either a staff member's
 * last-known location, or a site's fixed location. Prefixed keys (person:/site:) since
 * a staff id and a site id could otherwise collide. */
interface SelectablePoint {
  key: string;
  label: string;
  lat: number;
  lng: number;
}

function formatKm(meters: number): string {
  return `${(meters / 1000).toFixed(2)} km`;
}

/** Staff + site locations on one map. Tapping any two pins (staff-staff, staff-site, or
 * site-site) draws a line between them and labels it with the straight-line distance --
 * the same haversine formula already used for geofence checks elsewhere, so this always
 * agrees with the "nearest site" distance shown in the list view. */
export default function TrackMap({ staff, sites }: { staff: StaffPoint[]; sites: SitePoint[] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const measureLayerRef = useRef<L.LayerGroup | null>(null);
  const [selected, setSelected] = useState<SelectablePoint[]>([]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = L.map(containerRef.current).setView(INDIA_CENTER, 5);
    mapRef.current = map;
    const baseLayers = createBaseLayers();
    baseLayers[DEFAULT_BASE_LAYER].addTo(map);
    L.control.layers(baseLayers).addTo(map);
    measureLayerRef.current = L.layerGroup().addTo(map);

    return () => {
      map.remove();
      mapRef.current = null;
      measureLayerRef.current = null;
    };
  }, []);

  function togglePoint(point: SelectablePoint) {
    setSelected((prev) => {
      if (prev.some((p) => p.key === point.key)) return prev.filter((p) => p.key !== point.key);
      if (prev.length >= 2) return [prev[1], point];
      return [...prev, point];
    });
  }

  // Staff + site markers.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const layerGroup = L.layerGroup().addTo(map);
    const bounds: [number, number][] = [];

    for (const p of staff) {
      bounds.push([p.lat, p.lng]);
      const key = `person:${p.id}`;
      const isSelected = selected.some((s) => s.key === key);
      const icon = L.divIcon({
        className: "",
        html: `<div style="width:${isSelected ? 20 : 14}px;height:${isSelected ? 20 : 14}px;border-radius:50%;background:${TIER_COLOR[p.tier]};border:2px solid ${isSelected ? "#1d4ed8" : "#fff"};box-shadow:0 1px 4px rgba(0,0,0,0.4)"></div>`,
        iconSize: [isSelected ? 20 : 14, isSelected ? 20 : 14],
        iconAnchor: [isSelected ? 10 : 7, isSelected ? 10 : 7],
      });
      L.marker([p.lat, p.lng], { icon })
        .bindTooltip(p.name, { permanent: true, direction: "top", offset: [0, -10], className: "afs-map-label" })
        .on("click", () => togglePoint({ key, label: p.name, lat: p.lat, lng: p.lng }))
        .addTo(layerGroup);
    }

    for (const s of sites) {
      bounds.push([s.lat, s.lng]);
      const key = `site:${s.id}`;
      const isSelected = selected.some((sel) => sel.key === key);
      const size = isSelected ? 22 : 16;
      const icon = L.divIcon({
        className: "",
        html: `<div style="width:${size}px;height:${size}px;background:#7c3aed;border:2px solid ${isSelected ? "#1d4ed8" : "#fff"};box-shadow:0 1px 4px rgba(0,0,0,0.4);transform:rotate(45deg);"></div>`,
        iconSize: [size, size],
        iconAnchor: [size / 2, size / 2],
      });
      L.marker([s.lat, s.lng], { icon })
        .bindTooltip(`📍 ${s.name}`, { permanent: true, direction: "top", offset: [0, -10], className: "afs-map-label" })
        .on("click", () => togglePoint({ key, label: s.name, lat: s.lat, lng: s.lng }))
        .addTo(layerGroup);
    }

    if (bounds.length > 0) {
      map.fitBounds(bounds, { padding: [30, 30], maxZoom: 15 });
    }

    return () => {
      layerGroup.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [staff, sites, selected]);

  // Measuring line between the two currently-selected points.
  useEffect(() => {
    const map = mapRef.current;
    const layer = measureLayerRef.current;
    if (!map || !layer) return;
    layer.clearLayers();

    if (selected.length !== 2) return;
    const [a, b] = selected;
    const distanceM = haversineDistanceMeters(a.lat, a.lng, b.lat, b.lng);
    const mid: [number, number] = [(a.lat + b.lat) / 2, (a.lng + b.lng) / 2];

    L.polyline(
      [
        [a.lat, a.lng],
        [b.lat, b.lng],
      ],
      { color: "#1d4ed8", weight: 3, dashArray: "6 6" }
    ).addTo(layer);

    L.marker(mid, {
      icon: L.divIcon({
        className: "",
        html: `<div style="display:inline-block;background:#1d4ed8;color:#fff;font-size:12px;font-weight:600;padding:3px 8px;border-radius:12px;white-space:nowrap;box-shadow:0 1px 4px rgba(0,0,0,0.3)">${formatKm(distanceM)}</div>`,
        iconSize: [100, 24],
        iconAnchor: [50, 12],
      }),
      interactive: false,
    }).addTo(layer);
  }, [selected]);

  return (
    <div>
      <div
        ref={containerRef}
        style={{
          width: "100%",
          height: 420,
          borderRadius: 12,
          overflow: "hidden",
          // Leaflet's tile/control panes use z-index up to 1000 internally, which
          // should stay contained to their own stacking context -- but some WebViews
          // (seen on Android) don't reliably isolate that from GPU-composited
          // position:fixed overlays like the sidebar, letting the map render on top
          // regardless of DOM z-index. `isolation` forces a real stacking context.
          position: "relative",
          isolation: "isolate",
          zIndex: 0,
        }}
      />
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8, fontSize: 12.5, color: "#556" }}>
        <span>
          Tap two pins (staff — green/amber/grey dots, sites — purple diamonds) to measure the distance between them.
          {selected.length === 1 && ` Selected: ${selected[0].label}. Tap one more.`}
          {selected.length === 2 && (
            <>
              {" "}
              <b>
                {selected[0].label} ↔ {selected[1].label}: {formatKm(haversineDistanceMeters(selected[0].lat, selected[0].lng, selected[1].lat, selected[1].lng))}
              </b>
            </>
          )}
        </span>
        {selected.length > 0 && (
          <button type="button" onClick={() => setSelected([])} className="afs-btn" style={{ padding: "3px 10px", fontSize: 12, background: "#e5e7eb", color: "#333" }}>
            Clear
          </button>
        )}
      </div>
    </div>
  );
}
