// Rate limits for routes anyone can reach. They answer 429 with a Retry-After header.

import { ApiError } from "@/lib/api";
import { ipFromHeaders } from "@/lib/audit";
import { consume } from "@/lib/rate-limit";

export function enforce(key: string, limit: number, windowMs: number, what = "requests") {
  const r = consume(key, limit, windowMs);
  if (!r.ok) {
    throw new ApiError(
      429,
      "RATE_LIMITED",
      `Too many ${what}. Please try again in ${r.retryAfterSeconds} seconds.`,
      r.retryAfterSeconds,
    );
  }
}

/**
 * Limit per visitor IP. When the IP is unknown (no reverse proxy) everyone shares one bucket,
 * so that bucket gets 10 times the limit and only blunts floods.
 */
export function enforceIp(headers: Headers, name: string, limit: number, windowMs: number, what?: string) {
  const ip = ipFromHeaders(headers);
  enforce(`${name}:${ip ?? "unknown"}`, ip ? limit : limit * 10, windowMs, what);
}
