/**
 * Riot Games Store API Client
 *
 * Handles fetching player-specific store data from Riot's Valorant API:
 * - Daily store offers
 * - Wallet balances (VP, RP)
 * - Night Market (bonus store)
 *
 * Security: This module runs server-side only. Requires authenticated session tokens.
 */

import type { RiotStorefront, RiotWallet } from "../types/riot";
import type { SessionData } from "./session";
import { createLogger } from "./logger";

const log = createLogger("riot-api");

// Riot PD (Player Data) API endpoints
const RIOT_PD_BASE = "https://pd.{region}.a.pvp.net";

// Region shards for Riot API
const REGION_SHARDS: Record<string, string> = {
  na: "na",
  eu: "eu",
  kr: "kr",
  ap: "ap",
  latam: "na", // LATAM uses NA shard
  br: "na", // Brazil uses NA shard
};

/**
 * Get the correct PD API base URL for a region
 */
function getPdUrl(region: string): string {
  const shard = REGION_SHARDS[region.toLowerCase()] || "na";
  return RIOT_PD_BASE.replace("{region}", shard);
}

/**
 * Fetch player's current store offers
 * Returns the daily 4-item rotation and featured bundles
 *
 * @param session Authenticated session data with tokens
 * @returns Store data or error
 */
export async function getPlayerStore(
  session: SessionData
): Promise<{ success: true; data: RiotStorefront } | { success: false; error: string }> {
  try {
    const pdUrl = getPdUrl(session.region);
    const url = `${pdUrl}/store/v2/storefront/${session.puuid}`;

    const response = await fetch(url, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${session.accessToken}`,
        "X-Riot-Entitlements-JWT": session.entitlementsToken,
        "X-Riot-ClientPlatform": "ew0KCSJwbGF0Zm9ybVR5cGUiOiAiUEMiLA0KCSJwbGF0Zm9ybU9TIjogIldpbmRvd3MiLA0KCSJwbGF0Zm9ybU9TVmVyc2lvbiI6ICIxMC4wLjE5MDQyLjEuMjU2LjY0Yml0IiwNCgkicGxhdGZvcm1DaGlwc2V0IjogIlVua25vd24iDQp9",
        "X-Riot-ClientVersion": "release-08.00-shipping-9-2059217",
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      log.error("Store fetch failed:", response.status, errorText);

      if (response.status === 401 || response.status === 403) {
        return { success: false, error: "Authentication expired. Please log in again." };
      }

      return {
        success: false,
        error: `Riot API error: ${response.status} ${response.statusText}`,
      };
    }

    const data: RiotStorefront = await response.json();
    return { success: true, data };
  } catch (error) {
    log.error("Store fetch error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Fetch player's wallet balances
 * Returns VP (Valorant Points), RP (Radianite Points), and other currencies
 *
 * @param session Authenticated session data with tokens
 * @returns Wallet data or error
 */
export async function getWallet(
  session: SessionData
): Promise<{ success: true; data: RiotWallet } | { success: false; error: string }> {
  try {
    const pdUrl = getPdUrl(session.region);
    const url = `${pdUrl}/store/v1/wallet/${session.puuid}`;

    const response = await fetch(url, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${session.accessToken}`,
        "X-Riot-Entitlements-JWT": session.entitlementsToken,
        "X-Riot-ClientPlatform": "ew0KCSJwbGF0Zm9ybVR5cGUiOiAiUEMiLA0KCSJwbGF0Zm9ybU9TIjogIldpbmRvd3MiLA0KCSJwbGF0Zm9ybU9TVmVyc2lvbiI6ICIxMC4wLjE5MDQyLjEuMjU2LjY0Yml0IiwNCgkicGxhdGZvcm1DaGlwc2V0IjogIlVua25vd24iDQp9",
        "X-Riot-ClientVersion": "release-08.00-shipping-9-2059217",
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      log.error("Wallet fetch failed:", response.status, errorText);

      if (response.status === 401 || response.status === 403) {
        return { success: false, error: "Authentication expired. Please log in again." };
      }

      return {
        success: false,
        error: `Riot API error: ${response.status} ${response.statusText}`,
      };
    }

    const data: RiotWallet = await response.json();
    return { success: true, data };
  } catch (error) {
    log.error("Wallet fetch error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Fetch both store and wallet data in parallel
 * More efficient than calling them separately
 *
 * @param session Authenticated session data with tokens
 * @returns Combined store and wallet data
 */
export async function getStoreAndWallet(session: SessionData): Promise<{
  store: { success: true; data: RiotStorefront } | { success: false; error: string };
  wallet: { success: true; data: RiotWallet } | { success: false; error: string };
}> {
  const [store, wallet] = await Promise.all([
    getPlayerStore(session),
    getWallet(session),
  ]);

  return { store, wallet };
}

/**
 * Check if the player has an active Night Market
 *
 * @param storefront Store data from getPlayerStore()
 * @returns True if Night Market is active
 */
export function hasNightMarket(storefront: RiotStorefront): boolean {
  return (
    !!storefront.BonusStore &&
    storefront.BonusStore.BonusStoreOffers.length > 0 &&
    storefront.BonusStore.BonusStoreRemainingDurationInSeconds > 0
  );
}

/**
 * Calculate store reset time from remaining seconds
 *
 * @param remainingSeconds Seconds until store resets
 * @returns Date object of reset time
 */
export function getStoreResetTime(remainingSeconds: number): Date {
  return new Date(Date.now() + remainingSeconds * 1000);
}
