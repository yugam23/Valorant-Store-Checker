/**
 * Server-side Store Data Cache
 *
 * Caches store data in Redis so users can view their store
 * even after the Riot access token expires (~1 hour).
 * The daily store only rotates once per day, so cached data
 * stays valid until the store timer expires.
 *
 * Architecture note (Redis-backed cache):
 * This module uses Upstash Redis for serverless-cold-start persistence.
 * TTL is dynamic based on expiresAt from the store data.
 *
 * The public API (getCachedStore / setCachedStore / clearCachedStore)
 * is deliberately simple so swapping the backend is a drop-in change.
 */

import { redis } from "@/lib/redis-client";
import type { StoreData } from "@/types/store";

interface CacheEntry {
  data: StoreData;
  cachedAt: number;
}

const STORE_KEY_PREFIX = "store:";
const STORE_ORDER_KEY = "store:order"; // Sorted set for FIFO eviction — O(1) trim
const MAX_CACHE_ENTRIES = 10;

/**
 * Get cached store data for a player's PUUID.
 * Returns null if not cached or if the cache entry has expired.
 */
export async function getCachedStore(puuid: string): Promise<StoreData | null> {
  const key = `${STORE_KEY_PREFIX}${puuid}`;

  if (!redis) return null;

  let cached: string | null;
  try {
    cached = await redis.get<string>(key);
  } catch {
    // Redis error (timeout, connection failure) — treat as cache miss
    return null;
  }

  if (!cached) return null;

  let entry: CacheEntry;
  try {
    entry = JSON.parse(cached) as CacheEntry;
  } catch {
    // Malformed JSON — treat as miss
    if (redis) await redis.del(key);
    return null;
  }

  // Check if the store has rotated (expiresAt has passed)
  const expiresAt = new Date(entry.data.expiresAt).getTime();
  if (Date.now() > expiresAt) {
    if (redis) await redis.del(key);
    return null;
  }

  return entry.data;
}

/**
 * Cache store data for a player's PUUID.
 * Uses a Redis Sorted Set for O(1) FIFO eviction — no SCAN needed.
 */
export async function setCachedStore(puuid: string, data: StoreData): Promise<void> {
  if (!redis) return;

  const key = `${STORE_KEY_PREFIX}${puuid}`;

  // Calculate TTL in seconds based on expiresAt
  const expiresAtMs = new Date(data.expiresAt).getTime();
  const ttlSeconds = Math.ceil((expiresAtMs - Date.now()) / 1000);

  // If expiresAt is in the past, don't cache it
  if (ttlSeconds <= 0) {
    await redis.del(key);
    return;
  }

  const entry: CacheEntry = { data, cachedAt: Date.now() };

  // Atomic: set value + add to sorted set + trim to MAX_CACHE_ENTRIES
  // ZADD with score=timestamp for ordering, ZREMRANGEBYRANK to evict oldest
  const pipeline = redis.pipeline();
  pipeline.set(key, JSON.stringify(entry), { ex: ttlSeconds });
  pipeline.zadd(STORE_ORDER_KEY, { score: Date.now(), member: puuid });
  // Keep the newest MAX_CACHE_ENTRIES entries (negative indices = from end)
  pipeline.zremrangebyrank(STORE_ORDER_KEY, 0, -(MAX_CACHE_ENTRIES + 1));
  await pipeline.exec();
}

/**
 * Clear cached store data for a player's PUUID.
 */
export async function clearCachedStore(puuid: string): Promise<void> {
  if (!redis) return;
  const key = `${STORE_KEY_PREFIX}${puuid}`;
  const pipeline = redis.pipeline();
  pipeline.del(key);
  pipeline.zrem(STORE_ORDER_KEY, puuid);
  await pipeline.exec();
}
