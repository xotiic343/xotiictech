// Fixed-window rate limiter in memory. Fine for one web instance; move to Redis/Postgres if you scale out.
import "server-only";

type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();
let lastSweep = 0;

export function rateLimit(key: string, limit: number, windowMs: number) {
  const now = Date.now();
  if (now - lastSweep > 60_000) {
    lastSweep = now;
    for (const [k, b] of buckets) if (b.resetAt <= now) buckets.delete(k);
  }
  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true as const };
  }
  if (bucket.count >= limit) return { ok: false as const, retryAfterSec: Math.ceil((bucket.resetAt - now) / 1000) };
  bucket.count += 1;
  return { ok: true as const };
}
