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

interface GeocodeHit {
  lat: number;
  lng: number;
  label: string;
  postcode: string | null;
  /** Every place-name Nominatim attached to this hit (city, town, village, suburb,
   * district, state...), lowercased -- used to cross-check "does this pincode actually
   * belong to this city" without needing an exact single-field match, since Nominatim's
   * granularity (city vs district vs suburb) doesn't line up consistently between a
   * free-text address search and a bare-pincode search. */
  regionNames: Set<string>;
}

async function geocodeWithDetails(query: string): Promise<GeocodeHit | null> {
  const trimmed = query.trim();
  if (!trimmed) return null;

  try {
    const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&q=${encodeURIComponent(trimmed)}&limit=1&addressdetails=1`;
    const res = await fetch(url, {
      headers: { "User-Agent": "AarushFireBilling/1.0 (aarushfireprotection@gmail.com)" },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const hit = data?.[0];
    if (!hit) return null;

    const a = hit.address ?? {};
    // Deliberately excludes `state` -- Pune and Thane are both "Maharashtra", so
    // including state-level names produces false "matches" between genuinely different
    // cities that just happen to share a state. District-level and below is specific
    // enough to actually distinguish cities while still tolerating the granularity
    // mismatch between a landmark-style address search and a bare-pincode search.
    const regionNames = new Set(
      [a.city, a.town, a.village, a.suburb, a.neighbourhood, a.city_district, a.county, a.state_district]
        .filter((v): v is string => typeof v === "string" && v.length > 0)
        .map((v) => v.toLowerCase())
    );

    return { lat: Number(hit.lat), lng: Number(hit.lon), label: hit.display_name, postcode: a.postcode ?? null, regionNames };
  } catch {
    return null;
  }
}

/** Turns a free-text place name/address into coordinates, via the same Nominatim
 * endpoint reverseGeocode above already uses. Used by the site location picker so an
 * admin can type "TPC Sugar, Tanzania" or "Thane" instead of having to already know
 * (or hunt for) the exact lat/lng to click on a world map. */
export async function geocodeAddress(query: string): Promise<{ lat: number; lng: number; label: string } | null> {
  const hit = await geocodeWithDetails(query);
  return hit ? { lat: hit.lat, lng: hit.lng, label: hit.label } : null;
}

/** Looks up the pincode Nominatim associates with a free-text address -- used to
 * auto-fill the Pincode field as soon as an admin finishes typing the Address on the
 * New Site form. */
export async function pincodeForAddress(address: string): Promise<string | null> {
  const hit = await geocodeWithDetails(`${address}, India`);
  return hit?.postcode ?? null;
}

export interface PincodeCheckResult {
  /** true = confirmed match, false = confirmed mismatch, null = couldn't determine
   * (one or both sides failed to geocode) -- callers should not hard-block on null. */
  valid: boolean | null;
  suggestedPincode: string | null;
  resolvedCity: string | null;
}

/** Cross-checks a typed pincode against a typed address by geocoding each independently
 * and looking for any overlap in their resolved place names (city/town/district/state).
 * Deliberately a set-overlap rather than an exact-field match: Nominatim doesn't return
 * the same administrative level consistently for a landmark-style address search vs a
 * bare 6-digit pincode search, so comparing single fields produces false mismatches. */
export async function checkPincodeMatchesAddress(address: string, pincode: string): Promise<PincodeCheckResult> {
  const [addressHit, pincodeHit] = await Promise.all([
    geocodeWithDetails(`${address}, India`),
    geocodeWithDetails(`${pincode}, India`),
  ]);

  if (!addressHit || !pincodeHit) {
    return { valid: null, suggestedPincode: addressHit?.postcode ?? null, resolvedCity: null };
  }

  const overlaps = [...addressHit.regionNames].some((name) => pincodeHit.regionNames.has(name));
  const resolvedCity = pincodeHit.label.split(",").slice(0, 2).join(",").trim();

  return { valid: overlaps, suggestedPincode: addressHit.postcode, resolvedCity };
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
