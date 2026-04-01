/**
 * Upstash Rate Limiter Singleton
 *
 * Provides a global-singleton Ratelimit instance for Next.js hot-reload safety.
 * Uses sliding window algorithm with Redis as the backing store.
 *
 * Fails open: if Redis is unavailable, all requests pass through without limiting.
 */

import { Ratelimit } from "@upstash/ratelimit";
import { redis } from "./redis-client";
import { env } from "./env";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  reset: number;
  pending: Promise<unknown>;
}

// ---------------------------------------------------------------------------
// Global singleton (Next.js hot-reload safe)
// ---------------------------------------------------------------------------

declare global {
  var __authRatelimit: Ratelimit | undefined;
}

function getRatelimit(): Ratelimit {
  if (!global.__authRatelimit) {
    if (!redis) {
      throw new Error("Rate limiter requires Redis to be configured");
    }
    global.__authRatelimit = new Ratelimit({
      redis: redis,
      limiter: Ratelimit.slidingWindow(env.RATE_LIMIT_REQS_PER_MIN, "60 s"),
      analytics: false,
      timeout: 5000, // 5 second timeout for fail-open behavior
    });
  }
  return global.__authRatelimit;
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

// Lazy getter to avoid throwing at module load time when Redis is unavailable
export const authRatelimit = {
  limit: (ip: string) => getRatelimit().limit(ip),
};

export async function rateLimit(ip: string): Promise<RateLimitResult> {
  if (!redis) {
    // Fail open: allow all requests when Redis is unavailable (e.g., CI)
    return {
      success: true,
      limit: 0,
      remaining: 0,
      reset: 0,
      pending: Promise.resolve(0),
    };
  }
  return authRatelimit.limit(ip);
}
