/**
 * Upstash Rate Limiter Singleton
 *
 * Provides a global-singleton Ratelimit instance for Next.js hot-reload safety.
 * Uses sliding window algorithm with Redis as the backing store.
 */

import { Ratelimit } from "@upstash/ratelimit";
import { redis } from "./redis-client";
import { env } from "./env";

// ---------------------------------------------------------------------------
// Global singleton (Next.js hot-reload safe)
// ---------------------------------------------------------------------------

declare global {
  var __authRatelimit: Ratelimit | undefined;
}

function getRatelimit(): Ratelimit {
  if (!global.__authRatelimit) {
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

export const authRatelimit = getRatelimit();
