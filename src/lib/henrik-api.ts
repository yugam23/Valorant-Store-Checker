/**
 * Henrik Dev API Client
 *
 * Fetches account level and competitive rank data from the Henrik Dev API
 * (https://henrikdev.xyz), which provides unofficial Valorant stats.
 *
 * All functions:
 * - Cache results in memory for 5 minutes to respect rate limits
 * - Return null on failure (never throw) to support INFR-02 graceful degradation
 * - Return stale cache entries when the live fetch fails
 */

import { env } from "./env";
import { createLogger } from "./logger";

const log = createLogger("henrik-api");

const HENRIK_API_BASE = "https://api.henrikdev.xyz";
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Account data returned by Henrik /v2/by-puuid/account */
export interface HenrikAccount {
  puuid: string;
  region: string;
  account_level: number;
  name: string;
  tag: string;
  card: {
    small: string;
    large: string;
    wide: string;
    id: string;
  };
  last_update: string;
  last_update_raw: number;
}

/** Current MMR data nested inside Henrik /v2/by-puuid/mmr response */
export interface HenrikMMRCurrentData {
  currenttier: number;
  currenttier_patched: string;
  images: {
    small: string;
    large: string;
    triangle_down: string;
    triangle_up: string;
  };
  ranking_in_tier: number;
  mmr_change_to_last_game: number;
  elo: number;
  old: boolean;
}

// ---------------------------------------------------------------------------
// Cache
// ---------------------------------------------------------------------------

interface CacheEntry<T> {
  data: T;
  fetchedAt: number;
}

const accountCache = new Map<string, CacheEntry<HenrikAccount>>();
const mmrCache = new Map<string, CacheEntry<HenrikMMRCurrentData>>();

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Build Henrik API request headers, including the API key when configured. */
function henrikHeaders(): Record<string, string> {
  const headers: Record<string, string> = {};
  if (env.HENRIK_API_KEY) {
    headers["Authorization"] = env.HENRIK_API_KEY;
  } else {
    log.warn("HENRIK_API_KEY not set — Henrik API calls will return 401 in v4");
  }
  return headers;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Fetch Valorant account data by PUUID from the Henrik API.
 * Results are cached for 5 minutes. On failure, stale cache is returned.
 * Never throws — returns null if both live fetch and stale cache are unavailable.
 */
export async function getHenrikAccount(puuid: string, region: string): Promise<HenrikAccount | null> {
  const cached = accountCache.get(puuid);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL) {
    log.info("Returning cached Henrik account for PUUID:", puuid.substring(0, 8));
    return cached.data;
  }

  try {
    const response = await fetch(
      `${HENRIK_API_BASE}/valorant/v2/by-puuid/account/${region}/${puuid}`,
      {
        cache: "no-store",
        headers: henrikHeaders(),
      }
    );

    if (!response.ok) {
      log.warn("Henrik account fetch returned HTTP", response.status, "for PUUID:", puuid.substring(0, 8));
      return cached?.data ?? null;
    }

    const json = await response.json();
    const account = json.data as HenrikAccount;
    accountCache.set(puuid, { data: account, fetchedAt: Date.now() });
    log.info("Henrik account fetched successfully for PUUID:", puuid.substring(0, 8));
    return account;
  } catch (error) {
    log.error("Henrik account fetch network error for PUUID:", puuid.substring(0, 8), error);
    return cached?.data ?? null;
  }
}

/**
 * Fetch current competitive MMR data by PUUID from the Henrik API.
 * Results are cached for 5 minutes. On failure, stale cache is returned.
 * Never throws — returns null if both live fetch and stale cache are unavailable.
 */
export async function getHenrikMMR(puuid: string, region: string): Promise<HenrikMMRCurrentData | null> {
  const cached = mmrCache.get(puuid);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL) {
    log.info("Returning cached Henrik MMR for PUUID:", puuid.substring(0, 8));
    return cached.data;
  }

  try {
    const response = await fetch(
      `${HENRIK_API_BASE}/valorant/v2/by-puuid/mmr/${region}/${puuid}`,
      {
        cache: "no-store",
        headers: henrikHeaders(),
      }
    );

    if (!response.ok) {
      log.warn("Henrik MMR fetch returned HTTP", response.status, "for PUUID:", puuid.substring(0, 8));
      return cached?.data ?? null;
    }

    const json = await response.json();
    const mmrData = json.data.current_data as HenrikMMRCurrentData;
    mmrCache.set(puuid, { data: mmrData, fetchedAt: Date.now() });
    log.info("Henrik MMR fetched successfully for PUUID:", puuid.substring(0, 8));
    return mmrData;
  } catch (error) {
    log.error("Henrik MMR fetch network error for PUUID:", puuid.substring(0, 8), error);
    return cached?.data ?? null;
  }
}

/**
 * Clear the Henrik in-memory cache.
 * If puuid is provided, removes only that player's entries.
 * If no puuid is provided, clears all cached data.
 */
export function clearHenrikCache(puuid?: string): void {
  if (puuid) {
    accountCache.delete(puuid);
    mmrCache.delete(puuid);
  } else {
    accountCache.clear();
    mmrCache.clear();
  }
}
