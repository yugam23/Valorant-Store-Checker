/**
 * Profile Data Cache
 *
 * Orchestrates fetching of all player profile data — loadout (card/title),
 * Henrik account level, and competitive rank — with multi-tier fallback:
 *
 *   Tier 1: Live API fetch (Riot loadout + Henrik, in parallel)
 *   Tier 2: Stale cache (returned when ALL APIs fail)
 *   Tier 3: Partial data (no cache available, some APIs failed)
 *
 * This satisfies INFR-02 (graceful partial data when Henrik is unavailable)
 * and provides fromCache/partial/cachedAt metadata for INFR-03 (last updated notice).
 */

import { StoreTokens } from "./riot-store";
import { getPlayerLoadout } from "./riot-loadout";
import { getHenrikAccount, getHenrikMMR } from "./henrik-api";
import { getPlayerCardByUuid, getPlayerTitleByUuid } from "./valorant-api";
import { createLogger } from "./logger";

const log = createLogger("profile-cache");

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Full player profile data assembled from Riot loadout + Henrik APIs. */
export interface ProfileData {
  // From Riot loadout
  playerCardId?: string;
  playerTitleId?: string;
  accountLevel?: number;
  hideAccountLevel?: boolean;

  // Hydrated card data (from valorant-api.ts)
  playerCardSmallArt?: string;
  playerCardWideArt?: string;
  playerCardLargeArt?: string;
  playerTitleText?: string;         // null-safe: titleText can be null from API

  // From Henrik
  henrikAccountLevel?: number;
  competitiveTier?: number;
  competitiveTierName?: string;     // e.g. "Gold 1"
  competitiveTierIcon?: string;     // rank icon URL
  rankingInTier?: number;           // RR in current tier (0-100)
  mmrChangeToLastGame?: number;
  peakTier?: number;                // Note: Henrik v2 doesn't provide peak rank directly — defer to Phase 8

  // Metadata
  fromCache: boolean;
  partial: boolean;
  cachedAt?: number;                // timestamp for "last updated" display (INFR-03)
}

// ---------------------------------------------------------------------------
// Cache
// ---------------------------------------------------------------------------

interface ProfileCacheEntry {
  data: ProfileData;
  cachedAt: number;
}

const cache = new Map<string, ProfileCacheEntry>();

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Fetch complete profile data for the authenticated player.
 *
 * Fetches Riot loadout + Henrik account + Henrik MMR in parallel using
 * Promise.allSettled so that individual failures don't abort the others.
 *
 * If loadout succeeds, card and title UUIDs are hydrated to display names
 * and image URLs via valorant-api.ts.
 *
 * Fallback behavior:
 * - Any real data obtained → cache and return (partial: false)
 * - All APIs failed + stale cache → return stale with fromCache: true
 * - All APIs failed + no cache → return partial profile (partial: true)
 */
export async function getProfileData(tokens: StoreTokens, region: string): Promise<ProfileData> {
  // Tier 1: Fetch all sources in parallel; individual failures are tolerated
  const [loadoutResult, accountResult, mmrResult] = await Promise.allSettled([
    getPlayerLoadout(tokens),
    getHenrikAccount(tokens.puuid, region),
    getHenrikMMR(tokens.puuid, region),
  ]);

  const loadout = loadoutResult.status === "fulfilled" ? loadoutResult.value : null;
  const account = accountResult.status === "fulfilled" ? accountResult.value : null;
  const mmr = mmrResult.status === "fulfilled" ? mmrResult.value : null;

  if (loadoutResult.status === "rejected") {
    log.warn("Riot loadout fetch failed:", loadoutResult.reason);
  }
  if (accountResult.status === "rejected") {
    log.warn("Henrik account fetch failed:", accountResult.reason);
  }
  if (mmrResult.status === "rejected") {
    log.warn("Henrik MMR fetch failed:", mmrResult.reason);
  }

  // If loadout succeeded, hydrate card and title UUIDs to display data
  let cardData = null;
  let titleData = null;
  if (loadout) {
    [cardData, titleData] = await Promise.all([
      getPlayerCardByUuid(loadout.Identity.PlayerCardID),
      getPlayerTitleByUuid(loadout.Identity.PlayerTitleID),
    ]);
  }

  // Assemble ProfileData from whatever succeeded
  const profile: ProfileData = {
    // Loadout data
    playerCardId: loadout?.Identity.PlayerCardID,
    playerTitleId: loadout?.Identity.PlayerTitleID,
    accountLevel: loadout?.Identity.AccountLevel,
    hideAccountLevel: loadout?.Identity.HideAccountLevel,

    // Hydrated display data
    playerCardSmallArt: cardData?.smallArt,
    playerCardWideArt: cardData?.wideArt,
    playerCardLargeArt: cardData?.largeArt,
    playerTitleText: titleData?.titleText ?? undefined,

    // Henrik data
    henrikAccountLevel: account?.account_level,
    competitiveTier: mmr?.currenttier,
    competitiveTierName: mmr?.currenttier_patched,
    competitiveTierIcon: mmr?.images.large,
    rankingInTier: mmr?.ranking_in_tier,
    mmrChangeToLastGame: mmr?.mmr_change_to_last_game,

    // Metadata — partial if we got nothing useful from either primary source
    fromCache: false,
    partial: !loadout && !account,
    cachedAt: Date.now(),
  };

  // Tier 1 success: at least some real data was obtained
  if (!profile.partial) {
    cache.set(tokens.puuid, { data: profile, cachedAt: Date.now() });
    log.info("Profile fetched successfully for PUUID:", tokens.puuid.substring(0, 8));
    return profile;
  }

  // Tier 2: Total failure — try stale cache
  const stale = cache.get(tokens.puuid);
  if (stale) {
    log.warn("All APIs failed, returning stale cached profile for PUUID:", tokens.puuid.substring(0, 8));
    return { ...stale.data, fromCache: true };
  }

  // Tier 3: No stale cache available — return partial profile as-is
  log.warn("All APIs failed and no cache available, returning partial profile for PUUID:", tokens.puuid.substring(0, 8));
  return profile;
}

/**
 * Clear the profile cache.
 * If puuid is provided, removes only that player's entry.
 * If no puuid is provided, clears all cached profiles.
 */
export function clearProfileCache(puuid?: string): void {
  if (puuid) {
    cache.delete(puuid);
  } else {
    cache.clear();
  }
}
