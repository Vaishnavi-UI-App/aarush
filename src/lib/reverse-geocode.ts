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
