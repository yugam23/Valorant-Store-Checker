/**
 * Valorant-API.com client for fetching static game assets
 * @see https://valorant-api.com/
 */

import { createLogger } from "./logger";
import { redis } from "./redis-client";

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

// Cache expiration: 24 hours in milliseconds
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

// Redis TTL: 24 hours in seconds
const CACHE_TTL_SECONDS = 24 * 60 * 60;

/**
 * Store data in Redis with timestamp
 */
async function setCache<T>(key: string, data: T): Promise<void> {
  const payload = JSON.stringify({ data, timestamp: Date.now() });
  await redis.set(key, payload, { ex: CACHE_TTL_SECONDS });
}

/**
 * Get data from Redis and check if still valid
 * Returns null if not found or expired
 */
async function getCache<T>(key: string): Promise<{ data: T; timestamp: number } | null> {
  const raw = await redis.get<string>(key);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as { data: T; timestamp: number };
    // Check if cache is still within TTL
    if (Date.now() - parsed.timestamp > CACHE_TTL_MS) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

/**
 * Fetch all weapon skins from Valorant-API
 * Results are cached in Redis for 24 hours
 */
export async function getWeaponSkins(): Promise<ValorantWeaponSkin[]> {
  const cached = await getCache<ValorantWeaponSkin[]>(KEYS.skins);
  if (cached) {
    return cached.data;
  }

  try {
    const response = await fetch(`${VALORANT_API_BASE}/weapons/skins`, {
      headers: {
        "Content-Type": "application/json",
      },
      cache: "no-store",
      signal: AbortSignal.timeout(30_000),
    });

    if (!response.ok) {
      throw new Error(
        `Valorant-API returned ${response.status}: ${response.statusText}`
      );
    }

    const result: ValorantAPIResponse<ValorantWeaponSkin[]> =
      await response.json();

    if (result.status !== 200) {
      throw new Error(`Valorant-API error: status ${result.status}`);
    }

    // Store in Redis with 24h TTL
    await setCache(KEYS.skins, result.data);

    return result.data;
  } catch (error) {
    log.error("Failed to fetch weapon skins:", error);

    // Try to return expired cache on fetch failure (stale-while-revalidate)
    const stale = await getStaleCache<ValorantWeaponSkin[]>(KEYS.skins);
    if (stale) {
      log.warn("Using expired cache due to fetch failure");
      return stale;
    }

    throw error;
  }
}

/**
 * Fetch all content tiers (rarity levels) from Valorant-API
 * Results are cached in Redis for 24 hours
 */
export async function getContentTiers(): Promise<ValorantContentTier[]> {
  const cached = await getCache<ValorantContentTier[]>(KEYS.tiers);
  if (cached) {
    return cached.data;
  }

  try {
    const response = await fetch(`${VALORANT_API_BASE}/contenttiers`, {
      headers: {
        "Content-Type": "application/json",
      },
      cache: "no-store",
      signal: AbortSignal.timeout(30_000),
    });

    if (!response.ok) {
      throw new Error(
        `Valorant-API returned ${response.status}: ${response.statusText}`
      );
    }

    const result: ValorantAPIResponse<ValorantContentTier[]> =
      await response.json();

    if (result.status !== 200) {
      throw new Error(`Valorant-API error: status ${result.status}`);
    }

    // Store in Redis with 24h TTL
    await setCache(KEYS.tiers, result.data);

    return result.data;
  } catch (error) {
    log.error("Failed to fetch content tiers:", error);

    // Try to return expired cache on fetch failure (stale-while-revalidate)
    const stale = await getStaleCache<ValorantContentTier[]>(KEYS.tiers);
    if (stale) {
      log.warn("Using expired cache due to fetch failure");
      return stale;
    }

    throw error;
  }
}

/**
 * Fetch all bundles from Valorant-API
 * Results are cached in Redis for 24 hours
 */
export async function getBundles(): Promise<ValorantBundle[]> {
  const cached = await getCache<ValorantBundle[]>(KEYS.bundles);
  if (cached) {
    return cached.data;
  }

  try {
    const response = await fetch(`${VALORANT_API_BASE}/bundles`, {
      headers: {
        "Content-Type": "application/json",
      },
      cache: "no-store",
      signal: AbortSignal.timeout(30_000),
    });

    if (!response.ok) {
      throw new Error(
        `Valorant-API returned ${response.status}: ${response.statusText}`
      );
    }

    const result: ValorantAPIResponse<ValorantBundle[]> =
      await response.json();

    if (result.status !== 200) {
      throw new Error(`Valorant-API error: status ${result.status}`);
    }

    // Store in Redis with 24h TTL
    await setCache(KEYS.bundles, result.data);

    return result.data;
  } catch (error) {
    log.error("Failed to fetch bundles:", error);

    // Try to return expired cache on fetch failure (stale-while-revalidate)
    const stale = await getStaleCache<ValorantBundle[]>(KEYS.bundles);
    if (stale) {
      log.warn("Using expired cache due to fetch failure");
      return stale;
    }

    throw error;
  }
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
    return result.status === 200 ? result.data : null;
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
    return result.status === 200 ? result.data : null;
  } catch {
    return null;
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

  const normalizedUuids = uuids.map((uuid) => uuid.toLowerCase());

  for (const skin of skins) {
    const skinUuid = skin.uuid.toLowerCase();
    if (normalizedUuids.includes(skinUuid)) {
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

  for (const skin of skins) {
    // Check if any of this skin's level UUIDs match the requested UUIDs
    if (skin.levels) {
      for (const level of skin.levels) {
        if (normalizedUuids.has(level.uuid.toLowerCase())) {
          result.set(level.uuid.toLowerCase(), skin);
        }
      }
    }

    // Also check the parent skin UUID itself (some entitlements may use it)
    if (normalizedUuids.has(skin.uuid.toLowerCase())) {
      result.set(skin.uuid.toLowerCase(), skin);
    }
  }

  return result;
}

/**
 * Get stale cache data without TTL check (used for stale-while-revalidate)
 */
async function getStaleCache<T>(key: string): Promise<T | null> {
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
      competitiveTiers = result.data;
      // Store in Redis with 24h TTL
      await setCache(KEYS.competitive, competitiveTiers!);
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
 * Clear all caches (useful for testing or manual refresh)
 */
export async function clearCache(): Promise<void> {
  await redis.del(KEYS.skins);
  await redis.del(KEYS.tiers);
  await redis.del(KEYS.bundles);
  await redis.del(KEYS.competitive);
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
