/**
 * Riot Store API Client
 *
 * Handles communication with the authenticated Riot Store endpoints.
 * Requires valid access token and entitlements token.
 */

import { AuthTokens } from "./riot-auth";
import { RiotStorefront, RiotWallet } from "@/types/riot";

/**
 * Base64-encoded client platform identifier required by Riot PD endpoints.
 * This is the standard PC/Windows platform descriptor.
 */
const CLIENT_PLATFORM = btoa(JSON.stringify({
  platformType: "PC",
  platformOS: "Windows",
  platformOSVersion: "10.0.19042.1.256.64bit",
  platformChipset: "Unknown",
}));

/** Cached client version fetched from valorant-api.com */
let clientVersionCache: string | null = null;
let clientVersionFetchedAt = 0;
const VERSION_CACHE_TTL = 60 * 60 * 1000; // 1 hour

/**
 * Fetches the current Valorant client version from valorant-api.com
 */
async function getClientVersion(): Promise<string> {
  const now = Date.now();
  if (clientVersionCache && now - clientVersionFetchedAt < VERSION_CACHE_TTL) {
    return clientVersionCache;
  }

  try {
    const response = await fetch("https://valorant-api.com/v1/version", {
      next: { revalidate: 3600 },
    });

    if (response.ok) {
      const data = await response.json();
      const version: string = data.data.riotClientVersion;
      clientVersionCache = version;
      clientVersionFetchedAt = now;
      return version;
    }
  } catch (error) {
    console.warn("[riot-store] Failed to fetch client version:", error);
  }

  // Fallback if fetch fails
  return clientVersionCache || "release-09.06-shipping-20-2635846";
}

/**
 * Maps region code to the correct PD (Platform Domain) URL
 * Note: LATAM and BR often share the NA infrastructure for some services,
 * but for Store, they adhere to the specific shards.
 * However, commonly known shards are: na, eu, ap, kr.
 * LATAM/BR are part of the 'na' shard group for PD usually.
 */
function getPdUrl(region: string): string {
  // Normalize region
  const r = region.toLowerCase();

  switch (r) {
    case "na":
    case "latam":
    case "br":
      return "https://pd.na.a.pvp.net";
    case "ap":
    case "as":
    case "ind":
    case "jp":
    case "oce":
      return "https://pd.ap.a.pvp.net";
    case "eu":
    case "ru":
    case "tr":
      return "https://pd.eu.a.pvp.net";
    case "kr":
      return "https://pd.kr.a.pvp.net";
    default:
      // Fallback to NA
      return "https://pd.na.a.pvp.net";
  }
}

/**
 * Common headers for Riot Store API requests
 */
async function getStoreHeaders(tokens: AuthTokens) {
  const clientVersion = await getClientVersion();
  console.log(`[riot-store] Using Client Version: ${clientVersion}`);

  return {
    Authorization: `Bearer ${tokens.accessToken}`,
    "X-Riot-Entitlements-JWT": tokens.entitlementsToken,
    "X-Riot-ClientPlatform": CLIENT_PLATFORM,
    "X-Riot-ClientVersion": clientVersion,
  };
}

/**
 * Fetches the player's storefront (Daily Shop, Night Market, Bundles)
 * Endpoint: /store/v2/storefront/{puuid}
 */
// In-memory cache for the correct shard to avoid repeated discovery
let cachedShardRegion: string | null = null;

/**
 * Helper to fetch data with automatic shard fallback
 * If the primary shard returns 404, it tries other shards (na, eu, ap, kr)
 */
async function fetchWithShardFallback(
  tokens: AuthTokens,
  endpointBuilder: (pdUrl: string) => string
): Promise<Response> {
  const regions = ["na", "eu", "ap", "kr"];
  
  // Determine the order of regions to try
  let attempts = [cachedShardRegion || tokens.region];
  for (const r of regions) {
    if (!attempts.includes(r)) attempts.push(r);
  }

  let lastError: Error | null = null;
  const baseHeaders = await getStoreHeaders(tokens);

  for (const region of attempts) {
    const pdUrl = getPdUrl(region);
    const url = endpointBuilder(pdUrl);

    console.log(`[riot-store] Trying shard: ${region.toUpperCase()} (${url})`);

    try {
      // Determine method based on endpoint (v3 requires POST)
      const isV3 = url.includes("/v3/");
      const method = isV3 ? "POST" : "GET";
      const body = isV3 ? "{}" : undefined;
      const headers = isV3 
        ? { ...baseHeaders, "Content-Type": "application/json" }
        : baseHeaders;

      const response = await fetch(url, {
        method,
        headers,
        body,
        cache: "no-store",
      });

      if (response.ok) {
        if (region !== tokens.region && region !== cachedShardRegion) {
          console.log(`[riot-store] Discovered correct shard: ${region.toUpperCase()}`);
          cachedShardRegion = region;
        }
        return response;
      }

      // If 404/403/405, it might be the wrong shard or method, so try next shard
      if ([403, 404, 405].includes(response.status)) {
        console.warn(`[riot-store] Shard ${region.toUpperCase()} failed with ${response.status}. Retrying...`);
        const bodyText = await response.text().catch(() => "");
        console.warn(`[riot-store] Error body: ${bodyText}`);
        continue;
      }

      throw new Error(`Request failed with status ${response.status}`);
    } catch (err) {
      lastError = err as Error;
      console.warn(`[riot-store] Network error on ${region.toUpperCase()}:`, err);
    }
  }

  throw lastError || new Error("Failed to find correct shard for user data");
}

// ... existing imports ...

// ... existing code ...

export async function getStorefront(tokens: AuthTokens): Promise<RiotStorefront> {
  const response = await fetchWithShardFallback(tokens, (pdUrl) => 
    `${pdUrl}/store/v3/storefront/${tokens.puuid}`
  );

  const data = await response.json();
  return data as RiotStorefront;
}

/**
 * Fetches the player's wallet balance (VP, RP, KC)
 * Endpoint: /store/v1/wallet/{puuid}
 */
export async function getWallet(tokens: AuthTokens): Promise<RiotWallet> {
  const response = await fetchWithShardFallback(tokens, (pdUrl) => 
    `${pdUrl}/store/v1/wallet/${tokens.puuid}`
  );

  const data = await response.json();
  return data as RiotWallet;
}
