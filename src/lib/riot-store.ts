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
 * Retries up to 3 times before trying fallback endpoints.
 * Fallback order: riotclient.riotgames.com -> valorant-api.com -> hardcoded fallback
 */
async function getClientVersion(): Promise<string> {
  const now = Date.now();
  if (clientVersionCache && now - clientVersionFetchedAt < VERSION_CACHE_TTL) {
    return clientVersionCache;
  }

  let lastError: Error | null = null;

  // Try riotclient.riotgames.com first (primary source)
  const primaryVersion = await tryFetchFromRiotManifest();
  if (primaryVersion) {
    clientVersionCache = primaryVersion;
    clientVersionFetchedAt = now;
    log.info("Updated Client Version (Riot): %s", primaryVersion);
    return primaryVersion;
  }

  // Fallback to valorant-api.com (public API with version info)
  log.warn("Riot manifest endpoint failed, trying valorant-api.com fallback");
  try {
    const fallbackVersion = await tryFetchFromValorantAPI();
    if (fallbackVersion) {
      clientVersionCache = fallbackVersion;
      clientVersionFetchedAt = now;
      log.info("Updated Client Version (ValorantAPI): %s", fallbackVersion);
      return fallbackVersion;
    }
  } catch (error) {
    log.warn("Valorant-API fallback also failed:", error);
    lastError = error instanceof Error ? error : new Error(String(error));
  }

  // All sources failed — throw the last error
  if (lastError) {
    throw new Error(`Failed to fetch client version after 3 attempts: ${lastError.message}`);
  }

  // Last resort: use hardcoded fallback version
  // This version should be updated periodically or the app will eventually fail
  const hardcodedFallback = "release-12.05-shipping-22-4360629";
  log.warn("All version sources failed, using hardcoded fallback: %s", hardcodedFallback);
  clientVersionCache = hardcodedFallback;
  clientVersionFetchedAt = now;
  return hardcodedFallback;
}

/**
 * Try to fetch version from Riot's official manifest endpoint
 */
async function tryFetchFromRiotManifest(): Promise<string | null> {
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
        return version;
      } else {
        lastError = new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      log.warn(`Failed to fetch from Riot manifest (Attempt ${attempts + 1}/${maxAttempts}):`, error);
    }

    attempts++;
    if (attempts < maxAttempts) {
      // Exponential backoff: 500ms, 1000ms, 2000ms
      const delay = 500 * Math.pow(2, attempts - 1);
      await new Promise(r => setTimeout(r, delay));
    }
  }

  log.warn("Riot manifest endpoint failed after %d attempts. Last error: %s", maxAttempts, lastError?.message);
  return null;
}

/**
 * Try to fetch version from valorant-api.com (public API)
 * This is used as a fallback when Riot's endpoint is unreachable
 */
async function tryFetchFromValorantAPI(): Promise<string | null> {
  const response = await fetch("https://valorant-api.com/v1/version", {
    signal: AbortSignal.timeout(10_000),
  });

  if (!response.ok) {
    throw new Error(`Valorant-API returned ${response.status}: ${response.statusText}`);
  }

  const data = await response.json();
  // Valorant-API returns { status: 200, data: { riotClientVersion: "release-12.05-shipping-22-4360629", ... } }
  const version: string = data.data.riotClientVersion;

  if (!version) {
    throw new Error("Valorant-API response missing riotClientVersion field");
  }

  return version;
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
 * Fetch the player's storefront (Daily Shop, Night Market, Bundles)
 * Endpoint: /store/v2/storefront/{puuid}
 */
// In-memory cache for the correct shard to avoid repeated discovery.
// Keyed by PUUID so different users on different shards don't collide.
const cachedShardByPuuid = new Map<string, string>();

/**
 * Helper to fetch data with automatic shard fallback.
 * For initial shard discovery (no cached shard), tries all shards in parallel
 * and uses whichever responds first. On failure, falls back to sequential
 * retry with reduced timeout.
 */
export async function fetchWithShardFallback(
  tokens: StoreTokens,
  endpointBuilder: (pdUrl: string) => string
): Promise<Response> {
  const regions = ["na", "eu", "ap", "kr"];

  // Determine the order of regions to try
  const cachedShard = cachedShardByPuuid.get(tokens.puuid);
  const attempts: string[] = [cachedShard || tokens.region];
  for (const r of regions) {
    if (!attempts.includes(r)) attempts.push(r);
  }
  // Deduplicate to prevent redundant fetch calls when cachedShard === tokens.region
  const uniqueAttempts = [...new Set(attempts)];

  const baseHeaders = await getStoreHeaders(tokens);

  // Fast path: try cached shard first with a shorter timeout
  if (cachedShard && cachedShard !== tokens.region) {
    const pdUrl = getPdUrl(cachedShard);
    const url = endpointBuilder(pdUrl);
    log.info(`Fetching store for PUUID: ${tokens.puuid.substring(0, 8)} on cached shard: ${cachedShard.toUpperCase()}`);

    try {
      const response = await fetchWithRetry(url, baseHeaders, 10_000, false);
      if (response.ok) {
        return response;
      }
    } catch {
      // Cached shard failed, fall through to parallel discovery
      log.warn(`Cached shard ${cachedShard.toUpperCase()} failed, trying all shards in parallel`);
    }
  }

  // Initial discovery: try all remaining shards in parallel
  const remainingRegions = uniqueAttempts.filter(r => r !== cachedShard || !cachedShard);
  if (remainingRegions.length > 1) {
    const results = await Promise.allSettled(
      remainingRegions.map(region => {
        const pdUrl = getPdUrl(region);
        const url = endpointBuilder(pdUrl);
        log.info(`Parallel shard probe: ${region.toUpperCase()} for ${tokens.puuid.substring(0, 8)}`);
        return fetchWithRetry(url, baseHeaders, 10_000, true).then(r => ({ response: r, region }));
      })
    );

    // Use first successful response
    for (const result of results) {
      if (result.status === "fulfilled" && result.value.response.ok) {
        const region = result.value.region;
        log.info(`Shard discovery success: ${region.toUpperCase()} for ${tokens.puuid.substring(0, 8)}`);
        if (region !== tokens.region) {
          cachedShardByPuuid.set(tokens.puuid, region);
        }
        return result.value.response;
      }
    }
  }

  // Fallback: try remaining regions sequentially with longer timeout
  let lastError: Error | null = null;
  for (const region of remainingRegions) {
    const pdUrl = getPdUrl(region);
    const url = endpointBuilder(pdUrl);

    log.info(`Fetching store for PUUID: ${tokens.puuid.substring(0, 8)} on shard: ${region.toUpperCase()}`);

    try {
      const response = await fetchWithRetry(url, baseHeaders, 30_000, false);
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

      const errorBody = await response.text().catch(() => "No error body");
      throw new Error(`Request failed with status ${response.status}: ${errorBody}`);
    } catch (err) {
      lastError = err as Error;
      log.warn(`Network error on ${region.toUpperCase()}:`, err);
    }
  }

  throw lastError || new Error("Failed to find correct shard for user data");
}

/**
 * Perform a fetch with retry logic and configurable timeout.
 */
async function fetchWithRetry(
  url: string,
  baseHeaders: Record<string, string>,
  timeoutMs: number,
  isProbe: boolean
): Promise<Response> {
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
    signal: AbortSignal.timeout(timeoutMs),
  });

  // On probe success or non-error response, return immediately
  if (isProbe || response.ok || ![403, 404, 405].includes(response.status)) {
    return response;
  }

  // For 4xx errors during sequential fallback, consume the body before throwing
  const _bodyText = await response.text().catch(() => "");
  return response;
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
