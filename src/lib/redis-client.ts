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
import { createLogger } from "./logger";

const log = createLogger("Redis");

// ---------------------------------------------------------------------------
// Global singleton (Next.js hot-reload safe)
// ---------------------------------------------------------------------------

declare global {
  var __redis: Redis | null | undefined;
}

function getRedisClient(): Redis | null {
  if (global.__redis === undefined) {
    const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
    const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;

    if (!redisUrl || !redisToken) {
      log.warn("UPSTASH_REDIS_REST_URL or UPSTASH_REDIS_REST_TOKEN not set — Redis disabled");
      global.__redis = null;
    } else {
      global.__redis = new Redis({
        url: redisUrl,
        token: redisToken,
        automaticDeserialization: false,
      });
    }
  }
  return global.__redis;
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

export const redis = getRedisClient();
