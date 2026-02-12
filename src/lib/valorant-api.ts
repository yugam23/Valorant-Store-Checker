/**
 * Valorant-API.com client for fetching static game assets
 * @see https://valorant-api.com/
 */

import type {
  ValorantAPIResponse,
  ValorantWeaponSkin,
  ValorantContentTier,
} from "../types/riot";

const VALORANT_API_BASE = "https://valorant-api.com/v1";

// In-memory cache to avoid repeated fetches
let weaponSkinsCache: ValorantWeaponSkin[] | null = null;
let contentTiersCache: ValorantContentTier[] | null = null;
let lastFetchTime = {
  skins: 0,
  tiers: 0,
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
      // @ts-expect-error - Next.js extends fetch with next option
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
    console.error("[Valorant-API] Failed to fetch weapon skins:", error);

    // Return cached data if available, even if expired
    if (weaponSkinsCache) {
      console.warn(
        "[Valorant-API] Using expired cache due to fetch failure"
      );
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
      // @ts-expect-error - Next.js extends fetch with next option
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
    console.error("[Valorant-API] Failed to fetch content tiers:", error);

    // Return cached data if available, even if expired
    if (contentTiersCache) {
      console.warn(
        "[Valorant-API] Using expired cache due to fetch failure"
      );
      return contentTiersCache;
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
  lastFetchTime = { skins: 0, tiers: 0 };
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
  };
}
