/**
 * Valorant-API.com client for fetching static game assets
 * @see https://valorant-api.com/
 */

import { createLogger } from "./logger";

const log = createLogger("valorant-api");

import type {
  ValorantAPIResponse,
  ValorantWeaponSkin,
  ValorantContentTier,
  ValorantBundle,
} from "../types/riot";

const VALORANT_API_BASE = "https://valorant-api.com/v1";

// In-memory cache to avoid repeated fetches
let weaponSkinsCache: ValorantWeaponSkin[] | null = null;
let contentTiersCache: ValorantContentTier[] | null = null;
let bundlesCache: ValorantBundle[] | null = null;

let lastFetchTime = {
  skins: 0,
  tiers: 0,
  bundles: 0,
};

// Cache expiration: 24 hours (static data changes rarely)
const CACHE_TTL = 24 * 60 * 60 * 1000;

/**
 * Fetch all weapon skins from Valorant-API
 * Results are cached in memory for 24 hours
 */
export async function getWeaponSkins(): Promise<ValorantWeaponSkin[]> {
  const now = Date.now();

  // Return cached data if still valid
  if (weaponSkinsCache && now - lastFetchTime.skins < CACHE_TTL) {
    return weaponSkinsCache;
  }

  try {
    const response = await fetch(`${VALORANT_API_BASE}/weapons/skins`, {
      headers: {
        "Content-Type": "application/json",
      },
      next: {
        revalidate: 86400, // Next.js cache: 24 hours
      },
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

    // Update cache
    weaponSkinsCache = result.data;
    lastFetchTime.skins = now;

    return result.data;
  } catch (error) {
    log.error("Failed to fetch weapon skins:", error);

    // Return cached data if available, even if expired
    if (weaponSkinsCache) {
      log.warn("Using expired cache due to fetch failure");
      return weaponSkinsCache;
    }

    throw error;
  }
}

/**
 * Fetch all content tiers (rarity levels) from Valorant-API
 * Results are cached in memory for 24 hours
 */
export async function getContentTiers(): Promise<ValorantContentTier[]> {
  const now = Date.now();

  // Return cached data if still valid
  if (contentTiersCache && now - lastFetchTime.tiers < CACHE_TTL) {
    return contentTiersCache;
  }

  try {
    const response = await fetch(`${VALORANT_API_BASE}/contenttiers`, {
      headers: {
        "Content-Type": "application/json",
      },
      next: {
        revalidate: 86400, // Next.js cache: 24 hours
      },
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

    // Update cache
    contentTiersCache = result.data;
    lastFetchTime.tiers = now;

    return result.data;
  } catch (error) {
    log.error("Failed to fetch content tiers:", error);

    // Return cached data if available, even if expired
    if (contentTiersCache) {
      log.warn("Using expired cache due to fetch failure");
      return contentTiersCache;
    }

    throw error;
  }
}

/**
 * Fetch all bundles from Valorant-API
 * Results are cached in memory for 24 hours
 */
export async function getBundles(): Promise<ValorantBundle[]> {
  const now = Date.now();

  // Return cached data if still valid
  if (bundlesCache && now - lastFetchTime.bundles < CACHE_TTL) {
    return bundlesCache;
  }

  try {
    const response = await fetch(`${VALORANT_API_BASE}/bundles`, {
      headers: {
        "Content-Type": "application/json",
      },
      next: {
        revalidate: 86400, // Next.js cache: 24 hours
      },
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

    // Update cache
    bundlesCache = result.data;
    lastFetchTime.bundles = now;

    return result.data;
  } catch (error) {
    log.error("Failed to fetch bundles:", error);

    // Return cached data if available, even if expired
    if (bundlesCache) {
      log.warn("Using expired cache due to fetch failure");
      return bundlesCache;
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
 * Clear all caches (useful for testing or manual refresh)
 */
export function clearCache(): void {
  weaponSkinsCache = null;
  contentTiersCache = null;
  bundlesCache = null;
  lastFetchTime = { skins: 0, tiers: 0, bundles: 0 };
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
export function getCacheStatus() {
  const now = Date.now();
  return {
    weaponSkins: {
      cached: !!weaponSkinsCache,
      count: weaponSkinsCache?.length || 0,
      age: weaponSkinsCache ? now - lastFetchTime.skins : null,
      valid: weaponSkinsCache && now - lastFetchTime.skins < CACHE_TTL,
    },
    contentTiers: {
      cached: !!contentTiersCache,
      count: contentTiersCache?.length || 0,
      age: contentTiersCache ? now - lastFetchTime.tiers : null,
      valid: contentTiersCache && now - lastFetchTime.tiers < CACHE_TTL,
    },
    bundles: {
      cached: !!bundlesCache,
      count: bundlesCache?.length || 0,
      age: bundlesCache ? now - lastFetchTime.bundles : null,
      valid: bundlesCache && now - lastFetchTime.bundles < CACHE_TTL,
    },
  };
}
