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
const MAX_CACHE_ENTRIES = 10;

/**
 * Get cached store data for a player's PUUID.
 * Returns null if not cached or if the cache entry has expired.
 */
export async function getCachedStore(puuid: string): Promise<StoreData | null> {
  const key = `${STORE_KEY_PREFIX}${puuid}`;
  const cached = await redis.get<string>(key);

  if (!cached) return null;

  let entry: CacheEntry;
  try {
    entry = JSON.parse(cached) as CacheEntry;
  } catch {
    // Malformed JSON — treat as miss
    await redis.del(key);
    return null;
  }

  // Check if the store has rotated (expiresAt has passed)
  const expiresAt = new Date(entry.data.expiresAt).getTime();
  if (Date.now() > expiresAt) {
    await redis.del(key);
    return null;
  }

  return entry.data;
}

/**
 * Cache store data for a player's PUUID.
 * Implements FIFO eviction when at capacity (10 entries).
 */
export async function setCachedStore(puuid: string, data: StoreData): Promise<void> {
  const key = `${STORE_KEY_PREFIX}${puuid}`;

  // FIFO eviction: if adding a new entry and at capacity, evict oldest
  if (!(await redis.exists(key))) {
    const currentSize = await getCacheSize();
    if (currentSize >= MAX_CACHE_ENTRIES) {
      await evictOldestEntry();
    }
  }

  const entry: CacheEntry = { data, cachedAt: Date.now() };

  // Calculate TTL in seconds based on expiresAt
  const expiresAtMs = new Date(data.expiresAt).getTime();
  const ttlSeconds = Math.ceil((expiresAtMs - Date.now()) / 1000);

  // Only set TTL if it's in the future
  if (ttlSeconds > 0) {
    await redis.set(key, JSON.stringify(entry), { ex: ttlSeconds });
  } else {
    // If expiresAt is in the past, don't cache it
    await redis.del(key);
  }
}

/**
 * Clear cached store data for a player's PUUID.
 */
export async function clearCachedStore(puuid: string): Promise<void> {
  const key = `${STORE_KEY_PREFIX}${puuid}`;
  await redis.del(key);
}

// ---------------------------------------------------------------------------
// Helper functions
// ---------------------------------------------------------------------------

/**
 * Get cache size by scanning for store:* keys.
 */
async function getCacheSize(): Promise<number> {
  let cursor = "0";
  let count = 0;

  do {
    const [nextCursor, keys] = await redis.scan(cursor, {
      match: `${STORE_KEY_PREFIX}*`,
      count: 100,
    });
    cursor = nextCursor;
    count += keys.length;
  } while (cursor !== "0");

  return count;
}

/**
 * Evict the entry with the oldest cachedAt timestamp.
 */
async function evictOldestEntry(): Promise<void> {
  let oldestKey: string | null = null;
  let oldestCachedAt = Infinity;

  let cursor = "0";

  do {
    const [nextCursor, keys] = await redis.scan(cursor, {
      match: `${STORE_KEY_PREFIX}*`,
      count: 100,
    });
    cursor = nextCursor;

    for (const key of keys) {
      const cached = await redis.get<string>(key);
      if (cached) {
        try {
          const entry: CacheEntry = JSON.parse(cached) as CacheEntry;
          if (entry.cachedAt < oldestCachedAt) {
            oldestCachedAt = entry.cachedAt;
            oldestKey = key;
          }
        } catch {
          // Malformed entry, skip
        }
      }
    }
  } while (cursor !== "0");

  if (oldestKey) {
    await redis.del(oldestKey);
  }
}
