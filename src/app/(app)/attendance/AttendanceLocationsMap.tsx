"use client";

import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "@/lib/leaflet-labels.css";
import { createBaseLayers, DEFAULT_BASE_LAYER } from "@/lib/leaflet-layers";

export interface AttendancePoint {
  key: string;
  employeeName: string;
  kind: "CHECK_IN" | "CHECK_OUT";
  at: string;
  lat: number;
  lng: number;
}

const KIND_COLOR: Record<AttendancePoint["kind"], string> = { CHECK_IN: "#189a4b", CHECK_OUT: "#c9860e" };
const INDIA_CENTER: [number, number] = [20.5937, 78.9629];

/** Read-only map of where check-ins/check-outs were recorded -- not a live presence
 * view (that's the separate Track page/module). Plots the punch data it's given, once. */
export default function AttendanceLocationsMap({ points }: { points: AttendancePoint[] }) {
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

    for (const p of points) {
      bounds.push([p.lat, p.lng]);
      const icon = L.divIcon({
        className: "",
        html: `<div style="width:14px;height:14px;border-radius:50%;background:${KIND_COLOR[p.kind]};border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,0.4)"></div>`,
        iconSize: [14, 14],
        iconAnchor: [7, 7],
      });
      const label = `${p.employeeName} · ${p.kind === "CHECK_IN" ? "checked in" : "checked out"} ${new Date(p.at).toLocaleTimeString("en-IN")}`;
      L.marker([p.lat, p.lng], { icon })
        .bindTooltip(label, { permanent: true, direction: "top", offset: [0, -10], className: "afs-map-label" })
        .addTo(layerGroup);
    }

    if (bounds.length > 0) {
      map.fitBounds(bounds, { padding: [30, 30], maxZoom: 15 });
    } else {
      map.setView(INDIA_CENTER, 5);
    }

    return () => {
      layerGroup.remove();
    };
  }, [points]);

  return <div ref={containerRef} style={{ width: "100%", height: 360, borderRadius: 12, overflow: "hidden" }} />;
}
