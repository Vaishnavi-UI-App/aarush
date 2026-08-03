"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { formatRelative } from "@/lib/capture";

interface StaffPing {
  id: string;
  name: string | null;
  email: string;
  ping: { lat: string; lng: string; pingedAt: string } | null;
}

const REFRESH_MS = 30 * 1000;
const STALE_AFTER_MIN = 10;
const OFFLINE_AFTER_MIN = 30;

function freshnessTier(pingedAt: string): "fresh" | "stale" | "offline" {
  const minutesAgo = (Date.now() - new Date(pingedAt).getTime()) / 60000;
  if (minutesAgo < STALE_AFTER_MIN) return "fresh";
  if (minutesAgo < OFFLINE_AFTER_MIN) return "stale";
  return "offline";
}

const TIER_COLOR: Record<string, string> = {
  fresh: "#14532d",
  stale: "#92400e",
  offline: "#6b7280",
};
const TIER_BG: Record<string, string> = {
  fresh: "#dcfce7",
  stale: "#fef3c7",
  offline: "#f3f4f6",
};

export default function TrackView({ staff }: { staff: StaffPing[] }) {
  const router = useRouter();

  useEffect(() => {
    const interval = setInterval(() => router.refresh(), REFRESH_MS);
    return () => clearInterval(interval);
  }, [router]);

  return (
    <div className="afs-card">
      <table className="afs-table">
        <thead>
          <tr>
            <th>Staff</th>
            <th>Last seen</th>
            <th>Location</th>
          </tr>
        </thead>
        <tbody>
          {staff.map((s) => {
            const tier = s.ping ? freshnessTier(s.ping.pingedAt) : "offline";
            return (
              <tr key={s.id}>
                <td>{s.name || s.email}</td>
                <td>
                  {s.ping ? (
                    <span
                      style={{
                        color: TIER_COLOR[tier],
                        background: TIER_BG[tier],
                        borderRadius: 12,
                        padding: "2px 9px",
                        fontSize: 12,
                        fontWeight: 600,
                      }}
                    >
                      {tier === "offline" && s.ping ? `offline since ${formatRelative(new Date(s.ping.pingedAt))}` : formatRelative(new Date(s.ping.pingedAt))}
                    </span>
                  ) : (
                    <span style={{ color: "#6b7280", fontSize: 12 }}>never</span>
                  )}
                </td>
                <td>
                  {s.ping ? (
                    <a href={`https://www.google.com/maps?q=${s.ping.lat},${s.ping.lng}`} target="_blank" rel="noopener noreferrer">
                      {Number(s.ping.lat).toFixed(4)}, {Number(s.ping.lng).toFixed(4)} (map)
                    </a>
                  ) : (
                    "—"
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
