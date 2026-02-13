/**
 * Server-side Store Data Cache
 *
 * Caches store data in memory so users can view their store
 * even after the Riot access token expires (~1 hour).
 * The daily store only rotates once per day, so cached data
 * stays valid until the store timer expires.
 */

import type { StoreData } from "@/types/store";

interface CacheEntry {
  data: StoreData;
  cachedAt: number;
}

const cache = new Map<string, CacheEntry>();

export function getCachedStore(puuid: string): StoreData | null {
  const entry = cache.get(puuid);
  if (!entry) return null;

  // Check if the store has rotated (expiresAt has passed)
  const expiresAt = new Date(entry.data.expiresAt).getTime();
  if (Date.now() > expiresAt) {
    cache.delete(puuid);
    return null;
  }

  return entry.data;
}

export function setCachedStore(puuid: string, data: StoreData): void {
  cache.set(puuid, { data, cachedAt: Date.now() });
}

export function clearCachedStore(puuid: string): void {
  cache.delete(puuid);
}
