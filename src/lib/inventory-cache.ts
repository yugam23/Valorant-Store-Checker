/**
 * Server-side Inventory Data Cache
 *
 * Caches player's weapon skins collection in memory.
 * Similar to store-cache.ts, this allows users to view their collection
 * even if the Riot session is stale, as long as data was fetched once.
 */

import type { InventoryData } from "@/types/inventory";

interface CacheEntry {
  data: InventoryData;
  cachedAt: number;
}

const cache = new Map<string, CacheEntry>();

// Inventory data is relatively static but we'll use a 24h expiration
// or until the next fresh fetch.
const CACHE_TTL = 24 * 60 * 60 * 1000;

export function getCachedInventory(puuid: string): InventoryData | null {
  const entry = cache.get(puuid);
  if (!entry) return null;

  // Check if cache is too old (24h)
  if (Date.now() - entry.cachedAt > CACHE_TTL) {
    cache.delete(puuid);
    return null;
  }

  return entry.data;
}

export function setCachedInventory(puuid: string, data: InventoryData): void {
  cache.set(puuid, { data, cachedAt: Date.now() });
}

export function clearCachedInventory(puuid: string): void {
  cache.delete(puuid);
}
