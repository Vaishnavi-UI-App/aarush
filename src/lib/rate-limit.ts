/** Process-local sliding-window rate limiter -- fine for this single-instance
 * deployment (see nginx-shared-host setup), not a fit for a multi-instance one
 * without moving the counters to something shared like Redis. */
const hits = new Map<string, number[]>();

export function checkRateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  if (recent.length >= limit) {
    hits.set(key, recent);
    return false;
  }
  recent.push(now);
  hits.set(key, recent);
  return true;
}
