// A small in-memory limiter (fixed windows). It lives in the one app process, which is how
// QueueCare runs: one container. Counters are lost when the app restarts, which is acceptable
// for these limits. Limits that must survive restarts (check-in per phone per day) use the database.

interface Bucket {
  count: number;
  resetAt: number;
}

export interface LimitResult {
  ok: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

const holder = globalThis as unknown as { __rateBuckets?: Map<string, Bucket> };
const buckets: Map<string, Bucket> = (holder.__rateBuckets ??= new Map());
const MAX_BUCKETS = 10_000;

function sweep(now: number) {
  for (const [key, b] of buckets) if (b.resetAt <= now) buckets.delete(key);
}

/** Counts one use of `key`. `ok` is false once more than `limit` uses happen within `windowMs`. */
export function consume(key: string, limit: number, windowMs: number, now = Date.now()): LimitResult {
  if (buckets.size > MAX_BUCKETS) sweep(now);
  let b = buckets.get(key);
  if (!b || b.resetAt <= now) {
    b = { count: 0, resetAt: now + windowMs };
    buckets.set(key, b);
  }
  b.count += 1;
  return {
    ok: b.count <= limit,
    remaining: Math.max(0, limit - b.count),
    retryAfterSeconds: Math.max(1, Math.ceil((b.resetAt - now) / 1000)),
  };
}

/** Forget a key, for example after a successful login. */
export function resetLimit(key: string) {
  buckets.delete(key);
}

export function clearAllLimits() {
  buckets.clear();
}
