/**
 * Upstash Redis Client Singleton
 *
 * Provides a global-singleton Redis client for Next.js hot-reload safety.
 * On first call, creates the client using UPSTASH_REDIS_REST_URL and
 * UPSTASH_REDIS_REST_TOKEN environment variables. Subsequent calls return
 * the cached instance.
 *
 * Uses automaticDeserialization: false so we handle JSON parsing ourselves.
 */

import { Redis } from "@upstash/redis";

// ---------------------------------------------------------------------------
// Global singleton (Next.js hot-reload safe)
// ---------------------------------------------------------------------------

declare global {
  var __redis: Redis | undefined;
}

function getRedisClient(): Redis {
  if (!global.__redis) {
    global.__redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL!,
      token: process.env.UPSTASH_REDIS_REST_TOKEN!,
      automaticDeserialization: false,
    });
  }
  return global.__redis;
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

export const redis = getRedisClient();
