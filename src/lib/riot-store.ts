/**
 * Riot Store API Client
 *
 * Handles communication with the authenticated Riot Store endpoints.
 * Requires valid access token and entitlements token.
 */

import { RiotStorefront, RiotWallet } from "@/types/riot";
import { createLogger } from "./logger";
import { parseWithLog } from "@/lib/schemas/parse";
import { RiotStorefrontSchema, RiotWalletSchema } from "@/lib/schemas/storefront";

const log = createLogger("riot-store");

/** Minimum token set needed for store API requests */
export interface StoreTokens {
  accessToken: string;
  entitlementsToken: string;
  puuid: string;
  region: string;
}

/**
 * Base64-encoded client platform identifier required by Riot PD endpoints.
 * This is the standard PC/Windows platform descriptor.
 */
const CLIENT_PLATFORM = btoa(JSON.stringify({
  platformType: "PC",
  platformOS: "Windows",
  platformOSVersion: "10.0.19045.1.256.64bit",
  platformChipset: "Unknown",
}));

/** Cached client version fetched from Riot manifest endpoint */
let clientVersionCache: string | null = null;
let clientVersionFetchedAt = 0;
const VERSION_CACHE_TTL = 60 * 60 * 1000; // 1 hour

/**
 * Fetches the current Valorant client version from Riot's official manifest endpoint.
 * Retries up to 3 times before throwing an error.
 */
async function getClientVersion(): Promise<string> {
  const now = Date.now();
  if (clientVersionCache && now - clientVersionFetchedAt < VERSION_CACHE_TTL) {
    return clientVersionCache;
  }

  let attempts = 0;
  const maxAttempts = 3;
  let lastError: Error | null = null;

  while (attempts < maxAttempts) {
    try {
      const response = await fetch("https://riotclient.riotgames.com/riotclient/ux-middleware/bootstrap/manifest", {
        signal: AbortSignal.timeout(5_000),
      });

      if (response.ok) {
        const data = await response.json();
        // Riot's manifest endpoint returns { data: { manifests: { riotClientVersion: "..." } } }
        const version: string = data.data.manifests.riotClientVersion;
        clientVersionCache = version;
        clientVersionFetchedAt = now;
        log.info("Updated Client Version: %s", version);
        return version;
      } else {
        lastError = new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      log.warn(`Failed to fetch client version (Attempt ${attempts + 1}/${maxAttempts}):`, error);
    }

    attempts++;
    // Small backoff
    if (attempts < maxAttempts) await new Promise(r => setTimeout(r, 1000));
  }

  // Throw after all retries exhaust - do not silently fall back
  log.error("All client version fetch attempts failed. Last error: %s", lastError?.message);
  throw new Error(`Failed to fetch client version after ${maxAttempts} attempts: ${lastError?.message}`);
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
      return "https://pd.na.a.pvp.net";
    case "latam":
      return "https://pd.latam.a.pvp.net";
    case "br":
      return "https://pd.br.a.pvp.net";
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
async function getStoreHeaders(tokens: StoreTokens) {
  const clientVersion = await getClientVersion();
  log.debug(`Using Client Version: ${clientVersion}`);

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
// In-memory cache for the correct shard to avoid repeated discovery.
// Keyed by PUUID so different users on different shards don't collide.
const cachedShardByPuuid = new Map<string, string>();

/**
 * Helper to fetch data with automatic shard fallback
 * If the primary shard returns 404, it tries other shards (na, eu, ap, kr)
 */
export async function fetchWithShardFallback(
  tokens: StoreTokens,
  endpointBuilder: (pdUrl: string) => string
): Promise<Response> {
  const regions = ["na", "eu", "ap", "kr"];
  
  // Determine the order of regions to try
  const cachedShard = cachedShardByPuuid.get(tokens.puuid);
  const attempts = [cachedShard || tokens.region];
  for (const r of regions) {
    if (!attempts.includes(r)) attempts.push(r);
  }

  let lastError: Error | null = null;
  const baseHeaders = await getStoreHeaders(tokens);

  for (const region of attempts) {
    const pdUrl = getPdUrl(region);
    const url = endpointBuilder(pdUrl);

    log.info(`Fetching store for PUUID: ${tokens.puuid.substring(0, 8)} on shard: ${region.toUpperCase()} (${url})`);

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
        signal: AbortSignal.timeout(30_000),
      });

      if (response.ok) {
        if (region !== tokens.region && region !== cachedShard) {
          log.info(`Discovered correct shard: ${region.toUpperCase()}`);
          cachedShardByPuuid.set(tokens.puuid, region);
        }
        return response;
      }

      // If 404/403/405, it might be the wrong shard or method, so try next shard
      if ([403, 404, 405].includes(response.status)) {
        log.warn(`Shard ${region.toUpperCase()} failed with ${response.status}. Retrying...`);
        const bodyText = await response.text().catch(() => "");
        log.warn(`Error body: ${bodyText}`);
        continue;
      }

      // Important: catch the body for 400 errors to debug "Bad Request"
      const errorBody = await response.text().catch(() => "No error body");
      throw new Error(`Request failed with status ${response.status}: ${errorBody}`);
    } catch (err) {
      lastError = err as Error;
      log.warn(`Network error on ${region.toUpperCase()}:`, err);
    }
  }

  throw lastError || new Error("Failed to find correct shard for user data");
}

export async function getStorefront(tokens: StoreTokens): Promise<RiotStorefront | null> {
  const response = await fetchWithShardFallback(tokens, (pdUrl) =>
    `${pdUrl}/store/v3/storefront/${tokens.puuid}`
  );

  const data = await response.json();
  return parseWithLog(RiotStorefrontSchema, data, "RiotStorefront") as RiotStorefront | null;
}

/**
 * Fetches the player's wallet balance (VP, RP, KC)
 * Endpoint: /store/v1/wallet/{puuid}
 */
export async function getWallet(tokens: StoreTokens): Promise<RiotWallet | null> {
  const response = await fetchWithShardFallback(tokens, (pdUrl) => 
    `${pdUrl}/store/v1/wallet/${tokens.puuid}`
  );

  const data = await response.json();
  return parseWithLog(RiotWalletSchema, data, "RiotWallet") as RiotWallet | null;
}
