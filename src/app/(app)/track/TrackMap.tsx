"use client";

import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "@/lib/leaflet-labels.css";
import { createBaseLayers, DEFAULT_BASE_LAYER } from "@/lib/leaflet-layers";

export interface StaffPoint {
  id: string;
  name: string;
  lat: number;
  lng: number;
  tier: "fresh" | "stale" | "offline";
}

const TIER_COLOR: Record<StaffPoint["tier"], string> = { fresh: "#189a4b", stale: "#c9860e", offline: "#9aa2b1" };
const INDIA_CENTER: [number, number] = [20.5937, 78.9629];

/** Person-only map -- just where staff currently are, by name. No site pins: this is
 * about people, and the nearest-site distance is shown in the list view instead. */
export default function TrackMap({ staff }: { staff: StaffPoint[] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = L.map(containerRef.current).setView(INDIA_CENTER, 5);
    mapRef.current = map;
    const baseLayers = createBaseLayers();
    baseLayers[DEFAULT_BASE_LAYER].addTo(map);
    L.control.layers(baseLayers).addTo(map);

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const layerGroup = L.layerGroup().addTo(map);
    const bounds: [number, number][] = [];

    for (const p of staff) {
      bounds.push([p.lat, p.lng]);
      const icon = L.divIcon({
        className: "",
        html: `<div style="width:14px;height:14px;border-radius:50%;background:${TIER_COLOR[p.tier]};border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,0.4)"></div>`,
        iconSize: [14, 14],
        iconAnchor: [7, 7],
      });
      L.marker([p.lat, p.lng], { icon })
        .bindTooltip(p.name, { permanent: true, direction: "top", offset: [0, -10], className: "afs-map-label" })
        .addTo(layerGroup);
    }

    if (bounds.length > 0) {
      map.fitBounds(bounds, { padding: [30, 30], maxZoom: 15 });
    }

    return () => {
      layerGroup.remove();
    };
  }, [staff]);

  return (
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
  );
}
