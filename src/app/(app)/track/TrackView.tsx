"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { formatRelative } from "@/lib/capture";
import type { StaffPoint } from "./TrackMap";

const TrackMap = dynamic(() => import("./TrackMap"), { ssr: false, loading: () => <div className="afs-empty">Loading map…</div> });

interface StaffPing {
  id: string;
  name: string | null;
  email: string;
  ping: {
    lat: string | null;
    lng: string | null;
    placeName: string | null;
    pingedAt: string;
    sharingEnabled: boolean;
    nearestSiteName: string | null;
    distanceMeters: number | null;
  } | null;
}

interface SiteOption {
  id: string;
  name: string;
  latitude: string | null;
  longitude: string | null;
  geofenceRadiusM: number | null;
}

const REFRESH_MS = 30 * 1000;
const STALE_AFTER_MIN = 10;
const OFFLINE_AFTER_MIN = 30;

type Tier = "fresh" | "stale" | "offline";

function freshnessTier(pingedAt: string): Tier {
  const minutesAgo = (Date.now() - new Date(pingedAt).getTime()) / 60000;
  if (minutesAgo < STALE_AFTER_MIN) return "fresh";
  if (minutesAgo < OFFLINE_AFTER_MIN) return "stale";
  return "offline";
}

const TIER_COLOR: Record<Tier, string> = { fresh: "#14532d", stale: "#92400e", offline: "#6b7280" };
const TIER_BG: Record<Tier, string> = { fresh: "#dcfce7", stale: "#fef3c7", offline: "#f3f4f6" };

export default function TrackView({ staff, sites }: { staff: StaffPing[]; sites: SiteOption[] }) {
  const router = useRouter();
  const [filter, setFilter] = useState<"all" | Tier>("all");
  const [siteFilter, setSiteFilter] = useState("");

  useEffect(() => {
    const interval = setInterval(() => router.refresh(), REFRESH_MS);
    return () => clearInterval(interval);
  }, [router]);

  const rows = useMemo(() => staff.map((s) => ({ ...s, tier: (s.ping ? freshnessTier(s.ping.pingedAt) : "offline") as Tier })), [staff]);

  const filtered = rows.filter((r) => {
    if (filter !== "all" && r.tier !== filter) return false;
    if (siteFilter && r.ping?.nearestSiteName !== siteFilter) return false;
    return true;
  });

  const staffPoints: StaffPoint[] = useMemo(
    () =>
      rows
        .filter((r) => r.ping?.sharingEnabled && r.ping.lat != null && r.ping.lng != null)
        .map((r) => ({
          id: r.id,
          name: r.name || r.email,
          lat: Number(r.ping!.lat),
          lng: Number(r.ping!.lng),
          tier: r.tier,
        })),
    [rows]
  );

  return (
    <div>
      <div className="afs-card" style={{ marginBottom: 20, padding: 0, overflow: "hidden" }}>
        <TrackMap staff={staffPoints} />
      </div>

      <div className="afs-card" style={{ marginBottom: 20, padding: 16 }}>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
          <div className="afs-form-field" style={{ maxWidth: 180 }}>
            <label>Status</label>
            <select value={filter} onChange={(e) => setFilter(e.target.value as "all" | Tier)}>
              <option value="all">All</option>
              <option value="fresh">Online</option>
              <option value="stale">Stale</option>
              <option value="offline">Offline</option>
            </select>
          </div>
          <div className="afs-form-field" style={{ maxWidth: 220 }}>
            <label>Nearest site</label>
            <select value={siteFilter} onChange={(e) => setSiteFilter(e.target.value)}>
              <option value="">All</option>
              {sites.map((s) => (
                <option key={s.id} value={s.name}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
          <div style={{ fontSize: 13, color: "#374151", paddingBottom: 10 }}>
            {filtered.length} of {rows.length} shown
          </div>
        </div>
      </div>

      <div className="afs-card">
        <table className="afs-table">
          <thead>
            <tr>
              <th>Staff</th>
              <th>Sharing</th>
              <th>Last seen</th>
              <th>Nearest site</th>
              <th>Location</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((s) => (
              <tr key={s.id}>
                <td data-label="Staff">{s.name || s.email}</td>
                <td data-label="Sharing">
                  {s.ping?.sharingEnabled === false ? (
                    <span style={{ color: "#6b7280", fontSize: 12 }}>Off</span>
                  ) : (
                    <span style={{ color: "#14532d", fontSize: 12 }}>On</span>
                  )}
                </td>
                <td data-label="Last seen">
                  {s.ping ? (
                    <span
                      style={{
                        color: TIER_COLOR[s.tier],
                        background: TIER_BG[s.tier],
                        borderRadius: 12,
                        padding: "2px 9px",
                        fontSize: 12,
                        fontWeight: 600,
                      }}
                    >
                      {s.tier === "offline" ? `offline since ${formatRelative(new Date(s.ping.pingedAt))}` : formatRelative(new Date(s.ping.pingedAt))}
                    </span>
                  ) : (
                    <span style={{ color: "#6b7280", fontSize: 12 }}>never</span>
                  )}
                </td>
                <td data-label="Nearest site">
                  {s.ping?.nearestSiteName ? (
                    <span>
                      {s.ping.nearestSiteName}
                      {s.ping.distanceMeters != null && ` · ${(s.ping.distanceMeters / 1000).toFixed(2)}km`}
                    </span>
                  ) : (
                    <span style={{ color: "#889" }}>—</span>
                  )}
                </td>
                <td data-label="Location">
                  {s.ping?.lat && s.ping?.lng ? (
                    <a href={`https://www.google.com/maps?q=${s.ping.lat},${s.ping.lng}`} target="_blank" rel="noopener noreferrer">
                      {s.ping.placeName ?? `${Number(s.ping.lat).toFixed(4)}, ${Number(s.ping.lng).toFixed(4)}`} (map)
                    </a>
                  ) : (
                    "—"
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
