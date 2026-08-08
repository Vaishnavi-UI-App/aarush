/** Great-circle distance between two lat/lng points, in meters (haversine formula). */
export function haversineDistanceMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const EARTH_RADIUS_M = 6_371_000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_M * c;
}

export interface GeofenceCheck {
  withinGeofence: boolean | null; // null = site has no geofence configured, not enforced
  distanceMeters: number | null;
}

/** A site with no lat/lng/radius configured has no geofence -- every punch is "not applicable",
 * never blocked. Known limitation: GPS reported by the browser can be spoofed client-side;
 * there's no mock-location detection here (would need a native app / dedicated library). */
interface GeofencedSite {
  latitude: { toString(): string } | number | string | null;
  longitude: { toString(): string } | number | string | null;
  geofenceRadiusM: number | null;
}

export function checkGeofence(site: GeofencedSite | null | undefined, lat: number, lng: number): GeofenceCheck {
  if (!site || site.latitude == null || site.longitude == null || !site.geofenceRadiusM) {
    return { withinGeofence: null, distanceMeters: null };
  }
  const distanceMeters = Math.round(haversineDistanceMeters(Number(site.latitude), Number(site.longitude), lat, lng));
  return { withinGeofence: distanceMeters <= site.geofenceRadiusM, distanceMeters };
}

interface LocatableSite {
  id: string;
  latitude: { toString(): string } | number | string | null;
  longitude: { toString(): string } | number | string | null;
}

/** Purely informational (not tied to attendance/geofence enforcement) -- just "which
 * site is this position closest to, and how far". Only considers sites that actually
 * have coordinates set; ignores geofence radius entirely, since a site can be a useful
 * "nearest" reference point even with no configured geofence. */
export function findNearestSite<T extends LocatableSite>(sites: T[], lat: number, lng: number): { site: T; distanceMeters: number } | null {
  let best: { site: T; distanceMeters: number } | null = null;
  for (const site of sites) {
    if (site.latitude == null || site.longitude == null) continue;
    const distanceMeters = Math.round(haversineDistanceMeters(Number(site.latitude), Number(site.longitude), lat, lng));
    if (!best || distanceMeters < best.distanceMeters) best = { site, distanceMeters };
  }
  return best;
}
