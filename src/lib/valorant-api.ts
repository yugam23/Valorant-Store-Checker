/**
 * Valorant-API.com client for fetching static game assets
 * @see https://valorant-api.com/
 */

import { createLogger } from "./logger";
import { redis } from "./redis-client";
import { parseWithLog } from "@/lib/schemas/parse";
import { z } from "zod";
import {
  ValorantWeaponSkinSchema,
  ValorantContentTierSchema,
  ValorantBundleSchema,
  ValorantSkinLevelSchema,
  ValorantBuddyLevelSchema,
  ValorantSpraySchema,
  ValorantPlayerCardSchema,
  ValorantPlayerTitleSchema,
  CompetitiveSeasonSchema,
} from "@/lib/schemas/valorant-api";

const log = createLogger("valorant-api");

import type {
  ValorantAPIResponse,
  ValorantWeaponSkin,
  ValorantContentTier,
  ValorantBundle,
} from "../types/riot";

const VALORANT_API_BASE = "https://valorant-api.com/v1";

// Redis key prefixes
const KEYS = {
  skins: "valorant:skins",
  tiers: "valorant:tiers",
  bundles: "valorant:bundles",
  competitive: "valorant:competitive",
} as const;

// Cache TTL: 24 hours
const CACHE_TTL_SECONDS = 24 * 60 * 60;

/**
 * Store data in Redis with timestamp
 * Gracefully fails if Redis is unavailable (e.g., CI without Upstash credentials).
 * Never throws — callers proceed with uncached data on failure.
 */
async function setCache<T>(key: string, data: T): Promise<void> {
  if (!redis) return;
  try {
    const payload = JSON.stringify({ data, timestamp: Date.now() });
    await redis.set(key, payload, { ex: CACHE_TTL_SECONDS });
  } catch (err) {
    log.warn("Failed to set Redis cache, proceeding without cache:", err);
  }
}

/**
 * Get data from Redis and check if still valid
 * Returns null if not found or expired
 */
async function getCache<T>(key: string): Promise<{ data: T; timestamp: number } | null> {
  if (!redis) return null;
  const raw = await redis.get<string>(key);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as { data: T; timestamp: number };
    // Check if cache is still within TTL
    if (Date.now() - parsed.timestamp > CACHE_TTL_SECONDS * 1000) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

/**
 * Shared fetch-and-cache helper for list-type Valorant-API endpoints.
 * Handles cache-check, fetch, validation, cache-set, and stale-while-revalidate fallback.
 */
async function fetchAndCache<T>(
  key: string,
  url: string,
  schema: z.ZodSchema<T>,
  logName: string
): Promise<T> {
  const cached = await getCache<T>(key);
  if (cached) return cached.data;

  try {
    const response = await fetch(url, {
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(30_000),
    });

    if (!response.ok) {
      throw new Error(`Valorant-API returned ${response.status}: ${response.statusText}`);
    }

    const result: ValorantAPIResponse<T> = await response.json();
    if (result.status !== 200) {
      throw new Error(`Valorant-API error: status ${result.status}`);
    }

    const parsed = parseWithLog(schema, result.data, logName);
    if (!parsed) throw new Error(`Valorant-API validation failed for ${logName}`);

    await setCache(key, parsed);
    return parsed;
  } catch (error) {
    log.error(`Failed to fetch ${logName}:`, error);
    const stale = await getStaleCache<T>(key);
    if (stale) {
      log.warn("Using expired cache due to fetch failure");
      return stale;
    }
    throw error;
  }
}

/**
 * Fetch all weapon skins from Valorant-API
 * Results are cached in Redis for 24 hours
 */
export async function getWeaponSkins(): Promise<ValorantWeaponSkin[]> {
  return fetchAndCache(KEYS.skins, `${VALORANT_API_BASE}/weapons/skins`, ValorantWeaponSkinSchema.array(), "getWeaponSkins");
}

/**
 * Fetch all content tiers (rarity levels) from Valorant-API
 * Results are cached in Redis for 24 hours
 */
export async function getContentTiers(): Promise<ValorantContentTier[]> {
  return fetchAndCache(KEYS.tiers, `${VALORANT_API_BASE}/contenttiers`, ValorantContentTierSchema.array(), "getContentTiers");
}

/**
 * Fetch all bundles from Valorant-API
 * Results are cached in Redis for 24 hours
 */
export async function getBundles(): Promise<ValorantBundle[]> {
  return fetchAndCache(KEYS.bundles, `${VALORANT_API_BASE}/bundles`, ValorantBundleSchema.array(), "getBundles");
}

/**
 * Find a specific weapon skin by UUID
 * Uses cached data from getWeaponSkins()
 */
export async function getWeaponSkinByUuid(
  uuid: string
): Promise<ValorantWeaponSkin | null> {
  const skins = await getWeaponSkins();
  return skins.find((skin) => skin.uuid.toLowerCase() === uuid.toLowerCase()) || null;
}

/**
 * Find a specific content tier by UUID
 * Uses cached data from getContentTiers()
 */
export async function getContentTierByUuid(
  uuid: string
): Promise<ValorantContentTier | null> {
  const tiers = await getContentTiers();
  return tiers.find((tier) => tier.uuid.toLowerCase() === uuid.toLowerCase()) || null;
}

/**
 * Find a specific bundle by UUID
 * Uses cached data from getBundles()
 */
export async function getBundleByUuid(
  uuid: string
): Promise<ValorantBundle | null> {
  const bundles = await getBundles();
  return bundles.find((bundle) => bundle.uuid.toLowerCase() === uuid.toLowerCase()) || null;
}

export interface ValorantPlayerCard {
  uuid: string;
  displayName: string;
  isHiddenIfNotOwned: boolean;
  themeUuid: string | null;
  displayIcon: string | null;
  smallArt: string;
  wideArt: string;
  largeArt: string;
  assetPath: string;
}

export interface ValorantPlayerTitle {
  uuid: string;
  displayName: string;
  titleText: string | null; // null for "no title" equipped state
  isHiddenIfNotOwned: boolean;
  assetPath: string;
}

export interface ValorantSkinLevel {
  uuid: string;
  displayName: string;
  displayIcon: string | null;
  streamedVideo: string | null;
  assetPath: string;
}

export interface ValorantBuddyLevel {
  uuid: string;
  displayName: string;
  displayIcon: string | null;
  assetPath: string;
}

export interface ValorantSpray {
  uuid: string;
  displayName: string;
  displayIcon: string | null;
  largeArt: string | null;
  wideArt: string | null;
  assetPath: string;
}

/**
 * Fetch a player card by UUID from Valorant-API
 * Uses Next.js fetch-level caching (24h) — no module-level Map needed
 */
export async function getPlayerCardByUuid(uuid: string): Promise<ValorantPlayerCard | null> {
  try {
    const response = await fetch(`${VALORANT_API_BASE}/playercards/${uuid}`, {
      next: { revalidate: 86400 },
      signal: AbortSignal.timeout(30_000),
    });
    if (!response.ok) return null;
    const result: ValorantAPIResponse<ValorantPlayerCard> = await response.json();
    if (result.status !== 200) return null;
    const parsed = parseWithLog(ValorantPlayerCardSchema, result.data, "getPlayerCardByUuid");
    return parsed ?? null;
  } catch {
    return null;
  }
}

/**
 * Fetch a player title by UUID from Valorant-API
 * Uses Next.js fetch-level caching (24h) — no module-level Map needed
 */
export async function getPlayerTitleByUuid(uuid: string): Promise<ValorantPlayerTitle | null> {
  try {
    const response = await fetch(`${VALORANT_API_BASE}/playertitles/${uuid}`, {
      next: { revalidate: 86400 },
      signal: AbortSignal.timeout(30_000),
    });
    if (!response.ok) return null;
    const result: ValorantAPIResponse<ValorantPlayerTitle> = await response.json();
    if (result.status !== 200) return null;
    const parsed = parseWithLog(ValorantPlayerTitleSchema, result.data, "getPlayerTitleByUuid");
    return parsed ?? null;
  } catch {
    return null;
  }
}

/**
 * Fetch a skin level by UUID from Valorant-API
 * Results are cached in Redis for 24 hours
 */
export async function getSkinLevelByUuid(uuid: string): Promise<ValorantSkinLevel | null> {
  const cacheKey = `valorant:skinlevel:${uuid}`;
  const cached = await getCache<ValorantSkinLevel>(cacheKey);
  if (cached) {
    return cached.data;
  }

  try {
    const response = await fetch(`${VALORANT_API_BASE}/weapons/skinlevels/${uuid}`, {
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(30_000),
    });
    if (!response.ok) return null;
    const result: ValorantAPIResponse<ValorantSkinLevel> = await response.json();
    if (result.status !== 200 || !result.data) return null;
    const parsed = parseWithLog(ValorantSkinLevelSchema, result.data, "getSkinLevelByUuid");
    if (!parsed) return null;
    await setCache(cacheKey, parsed);
    return parsed;
  } catch {
    // Fall back to stale cache on error
    const stale = await getStaleCache<ValorantSkinLevel>(cacheKey);
    return stale;
  }
}

/**
 * Fetch a buddy level by UUID from Valorant-API
 * Results are cached in Redis for 24 hours
 */
export async function getBuddyLevelByUuid(uuid: string): Promise<ValorantBuddyLevel | null> {
  const cacheKey = `valorant:buddylevel:${uuid}`;
  const cached = await getCache<ValorantBuddyLevel>(cacheKey);
  if (cached) {
    return cached.data;
  }

  try {
    const response = await fetch(`${VALORANT_API_BASE}/buddies/levels/${uuid}`, {
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(30_000),
    });
    if (!response.ok) return null;
    const result: ValorantAPIResponse<ValorantBuddyLevel> = await response.json();
    if (result.status !== 200 || !result.data) return null;
    const parsed = parseWithLog(ValorantBuddyLevelSchema, result.data, "getBuddyLevelByUuid");
    if (!parsed) return null;
    await setCache(cacheKey, parsed);
    return parsed;
  } catch {
    const stale = await getStaleCache<ValorantBuddyLevel>(cacheKey);
    return stale;
  }
}

/**
 * Fetch a spray by UUID from Valorant-API
 * Results are cached in Redis for 24 hours
 */
export async function getSprayByUuid(uuid: string): Promise<ValorantSpray | null> {
  const cacheKey = `valorant:spray:${uuid}`;
  const cached = await getCache<ValorantSpray>(cacheKey);
  if (cached) {
    return cached.data;
  }

  try {
    const response = await fetch(`${VALORANT_API_BASE}/sprays/${uuid}`, {
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(30_000),
    });
    if (!response.ok) return null;
    const result: ValorantAPIResponse<ValorantSpray> = await response.json();
    if (result.status !== 200 || !result.data) return null;
    const parsed = parseWithLog(ValorantSpraySchema, result.data, "getSprayByUuid");
    if (!parsed) return null;
    await setCache(cacheKey, parsed);
    return parsed;
  } catch {
    const stale = await getStaleCache<ValorantSpray>(cacheKey);
    return stale;
  }
}

/**
 * Batch fetch weapon skins by UUIDs
 * More efficient than calling getWeaponSkinByUuid() multiple times
 */
export async function getWeaponSkinsByUuids(
  uuids: string[]
): Promise<Map<string, ValorantWeaponSkin>> {
  const skins = await getWeaponSkins();
  const result = new Map<string, ValorantWeaponSkin>();

  const normalizedUuids = new Set(uuids.map((uuid) => uuid.toLowerCase()));

  for (const skin of skins) {
    const skinUuid = skin.uuid.toLowerCase();
    if (normalizedUuids.has(skinUuid)) {
      result.set(skinUuid, skin);
    }
  }

  return result;
}

/**
 * Batch fetch weapon skins by their LEVEL UUIDs
 * The Riot entitlements API returns skin level UUIDs as ItemIDs,
 * not the parent skin UUIDs. This function builds a reverse lookup
 * map from level UUID → parent skin object.
 */
export async function getWeaponSkinsByLevelUuids(
  levelUuids: string[]
): Promise<Map<string, ValorantWeaponSkin>> {
  const skins = await getWeaponSkins();
  const result = new Map<string, ValorantWeaponSkin>();

  const normalizedUuids = new Set(levelUuids.map((uuid) => uuid.toLowerCase()));

  // Track which skin UUIDs we've already added to avoid duplicate entries
    const addedSkinUuids = new Set<string>();

    for (const skin of skins) {
      // Check the parent skin UUID itself
      if (normalizedUuids.has(skin.uuid.toLowerCase())) {
        result.set(skin.uuid.toLowerCase(), skin);
        addedSkinUuids.add(skin.uuid.toLowerCase());
        continue;
      }

      // Check if any of this skin's level UUIDs match
      const matchingLevel = skin.levels?.find((level) =>
        normalizedUuids.has(level.uuid.toLowerCase())
      );
      if (matchingLevel) {
        // Use level UUID as key, but don't overwrite if skin UUID was already added
        if (!addedSkinUuids.has(skin.uuid.toLowerCase())) {
          result.set(matchingLevel.uuid.toLowerCase(), skin);
        }
      }
    }

  return result;
}

/**
 * Get stale cache data without TTL check (used for stale-while-revalidate)
 */
async function getStaleCache<T>(key: string): Promise<T | null> {
  if (!redis) return null;
  const raw = await redis.get<string>(key);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as { data: T; timestamp: number };
    return parsed.data;
  } catch {
    return null;
  }
}

/**
 * Look up the large rank icon URL for a competitive tier ID.
 * Uses the latest competitive season tier table from valorant-api.com.
 * Tier IDs: 0=Unranked, 3-5=Iron 1-3, 6-8=Bronze, ..., 24=Radiant.
 * Returns null if the icon cannot be fetched.
 */
export async function getCompetitiveTierIconByTier(tierId: number): Promise<string | null> {
  const cached = await getCache<Array<{ tiers: Array<{ tier: number; largeIcon: string | null }> }>>(KEYS.competitive);
  let competitiveTiers = cached?.data;

  if (!competitiveTiers) {
    try {
      const response = await fetch(`${VALORANT_API_BASE}/competitivetiers`, {
        next: { revalidate: 86400 },
        signal: AbortSignal.timeout(30_000),
      });
      if (!response.ok) return null;
      const result = await response.json();
      const parsed = parseWithLog(CompetitiveSeasonSchema.array(), result.data, "getCompetitiveTierIconByTier");
      if (!parsed) return null;
      competitiveTiers = parsed;
      // Store in Redis with 24h TTL
      await setCache(KEYS.competitive, competitiveTiers);
    } catch {
      // Try to return stale cache on fetch failure
      const stale = await getStaleCache<Array<{ tiers: Array<{ tier: number; largeIcon: string | null }> }>>(KEYS.competitive);
      if (stale) {
        log.warn("Using expired competitive tiers cache due to fetch failure");
        competitiveTiers = stale;
      } else {
        return null;
      }
    }
  }

  if (!competitiveTiers || competitiveTiers.length === 0) return null;

  // The last entry in the array is the most recent competitive season
  const latestSeason = competitiveTiers[competitiveTiers.length - 1];
  const tier = latestSeason?.tiers?.find((t) => t.tier === tierId);
  return tier?.largeIcon ?? null;
}


/**
 * Get the best video URL for a skin
 * Prioritizes the highest level with a video (usually Level 4/Variant 1)
 * Returns null if no video is available
 */
export function getSkinVideo(skin: ValorantWeaponSkin): string | null {
  if (!skin.levels || skin.levels.length === 0) {
    return null;
  }

  // Try to find the highest level with a video
  // Iterate backwards as higher levels usually come last
  for (let i = skin.levels.length - 1; i >= 0; i--) {
    const level = skin.levels[i];
    if (!level) continue;
    if (level.streamedVideo) {
      return level.streamedVideo;
    }
  }

  // No video found in any level
  return null;
}

/**
 * Get cache status for monitoring
 */
export async function getCacheStatus(): Promise<{
  weaponSkins: { cached: boolean; count: number | null; age: number | null; valid: boolean };
  contentTiers: { cached: boolean; count: number | null; age: number | null; valid: boolean };
  bundles: { cached: boolean; count: number | null; age: number | null; valid: boolean };
}> {
  const skinsCached = await getCache<ValorantWeaponSkin[]>(KEYS.skins);
  const tiersCached = await getCache<ValorantContentTier[]>(KEYS.tiers);
  const bundlesCached = await getCache<ValorantBundle[]>(KEYS.bundles);

  const now = Date.now();

  return {
    weaponSkins: {
      cached: !!skinsCached,
      count: skinsCached?.data.length ?? null,
      age: skinsCached ? now - skinsCached.timestamp : null,
      valid: !!skinsCached,
    },
    contentTiers: {
      cached: !!tiersCached,
      count: tiersCached?.data.length ?? null,
      age: tiersCached ? now - tiersCached.timestamp : null,
      valid: !!tiersCached,
    },
    bundles: {
      cached: !!bundlesCached,
      count: bundlesCached?.data.length ?? null,
      age: bundlesCached ? now - bundlesCached.timestamp : null,
      valid: !!bundlesCached,
    },
  };
}
