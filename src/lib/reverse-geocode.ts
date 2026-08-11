/** Turns a lat/lng pair into a short human-readable place name (e.g. "Pimpri Chinchwad,
 * Pune") using OSM Nominatim -- the same map data source the app already uses for the
 * Leaflet tiles, so no separate API key is needed.
 *
 * Results are cached in-process, keyed by coordinates rounded to 3 decimals (~110m), so
 * repeat pings from the same spot (staff sitting at one site across several 30s refreshes)
 * don't re-hit Nominatim. This also keeps us well under Nominatim's 1 req/sec usage policy
 * for a small team's worth of distinct locations.
 */

interface CacheEntry {
  label: string | null;
  expiresAt: number;
}

const CACHE_TTL_MS = 60 * 60 * 1000;
const cache = new Map<string, CacheEntry>();

function cacheKey(lat: number, lng: number): string {
  return `${lat.toFixed(3)},${lng.toFixed(3)}`;
}

export async function reverseGeocode(lat: number, lng: number): Promise<string | null> {
  const key = cacheKey(lat, lng);
  const cached = cache.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.label;

  let label: string | null = null;
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&zoom=14&addressdetails=1`;
    const res = await fetch(url, {
      headers: {
        // Nominatim's usage policy requires an identifying User-Agent.
        "User-Agent": "AarushFireBilling/1.0 (aarushfireprotection@gmail.com)",
      },
      signal: AbortSignal.timeout(4000),
    });
    if (res.ok) {
      const data = await res.json();
      const a = data.address ?? {};
      const area = a.suburb || a.neighbourhood || a.town || a.city_district || a.village;
      const city = a.city || a.county;
      label = [area, city].filter(Boolean).join(", ") || data.display_name?.split(",").slice(0, 2).join(",") || null;
    }
  } catch {
    label = null;
  }

  cache.set(key, { label, expiresAt: Date.now() + CACHE_TTL_MS });
  return label;
}

/** Turns a free-text place name/address into coordinates, via the same Nominatim
 * endpoint reverseGeocode above already uses. Used by the site location picker so an
 * admin can type "TPC Sugar, Tanzania" or "Thane" instead of having to already know
 * (or hunt for) the exact lat/lng to click on a world map. */
export async function geocodeAddress(query: string): Promise<{ lat: number; lng: number; label: string } | null> {
  const trimmed = query.trim();
  if (!trimmed) return null;

  try {
    const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&q=${encodeURIComponent(trimmed)}&limit=1`;
    const res = await fetch(url, {
      headers: { "User-Agent": "AarushFireBilling/1.0 (aarushfireprotection@gmail.com)" },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const hit = data?.[0];
    if (!hit) return null;
    return { lat: Number(hit.lat), lng: Number(hit.lon), label: hit.display_name };
  } catch {
    return null;
  }
}

/** A pincode covers a whole postal area, not one building, so a pincode-geocoded location
 * gets a deliberately loose geofence -- an admin can tighten it later from the site's own
 * Location & Geofence map (which sets an exact point + radius via search/click/drag). */
export const PINCODE_GEOFENCE_RADIUS_M = 1000;

/** Builds the best available geocoding query for a site from whatever it has on file --
 * pincode is the most specific single field, so it leads; address adds context when
 * present. Returns null when there's nothing to geocode from. */
export async function geocodeSiteLocation(pincode: string | null | undefined, address: string | null | undefined) {
  const parts = [address?.trim(), pincode?.trim(), "India"].filter(Boolean);
  if (!pincode?.trim()) return null;
  return geocodeAddress(parts.join(", "));
}
