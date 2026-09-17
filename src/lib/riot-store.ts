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

/** Cached client version fetched from valorant-api.com */
let clientVersionCache: string | null = null;
let clientVersionFetchedAt = 0;
const VERSION_CACHE_TTL = 60 * 60 * 1000; // 1 hour

/**
 * Fetches the current Valorant client version from valorant-api.com.
 * riotclient.riotgames.com is not used: it no longer resolves in DNS, and every
 * attempt only added retries and delay before falling back here anyway.
 */
async function getClientVersion(): Promise<string> {
  const now = Date.now();
  if (clientVersionCache && now - clientVersionFetchedAt < VERSION_CACHE_TTL) {
    return clientVersionCache;
  }

  try {
    const version = await tryFetchFromValorantAPI();
    if (version) {
      clientVersionCache = version;
      clientVersionFetchedAt = now;
      log.info("Updated Client Version (ValorantAPI): %s", version);
      return version;
    }
  } catch (error) {
    log.warn("Valorant-API version fetch failed:", error);
    const lastError = error instanceof Error ? error : new Error(String(error));
    throw new Error(`Failed to fetch client version: ${lastError.message}`);
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
 * Try to fetch version from valorant-api.com (public API)
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
 *
 * Tries a single shard first — the one cached for this PUUID, or the session
 * region on first use — and remembers it on success, so the common case is one
 * request. Only when that shard fails are the other shards probed in parallel
 * (skipping any that map to an already-tried PD host); probes that errored at
 * the network level get one sequential retry with a longer timeout.
 */
export async function fetchWithShardFallback(
  tokens: StoreTokens,
  endpointBuilder: (pdUrl: string) => string
): Promise<Response> {
  const regions = ["na", "eu", "ap", "kr"];
  const preferred = cachedShardByPuuid.get(tokens.puuid) ?? tokens.region;

  const baseHeaders = await getStoreHeaders(tokens);

  // Fast path: one request to the preferred shard
  try {
    const response = await fetchWithRetry(endpointBuilder(getPdUrl(preferred)), baseHeaders, 10_000, true);
    if (response.ok) {
      cachedShardByPuuid.set(tokens.puuid, preferred);
      return response;
    }
    if (![403, 404, 405].includes(response.status)) {
      // Not a wrong-shard error (e.g. 401 expired token) — other shards won't help
      const errorBody = await response.text().catch(() => "No error body");
      throw new Error(`Request failed with status ${response.status}: ${errorBody}`);
    }
    log.warn(`Shard ${preferred.toUpperCase()} failed with ${response.status}, trying other shards`);
  } catch (err) {
    if (err instanceof Error && err.message.startsWith("Request failed with status")) throw err;
    log.warn(`Network error on ${preferred.toUpperCase()}, trying other shards:`, err);
  }

  // Remaining shards, deduplicated by PD host (e.g. "am" and "na" share pd.na)
  const triedHosts = new Set([getPdUrl(preferred)]);
  const others = [tokens.region, ...regions].filter((region) => {
    const host = getPdUrl(region);
    if (triedHosts.has(host)) return false;
    triedHosts.add(host);
    return true;
  });

  const results = await Promise.allSettled(
    others.map(region => {
      log.info(`Parallel shard probe: ${region.toUpperCase()} for ${tokens.puuid.substring(0, 8)}`);
      return fetchWithRetry(endpointBuilder(getPdUrl(region)), baseHeaders, 10_000, true).then(r => ({ response: r, region }));
    })
  );

  for (const result of results) {
    if (result.status === "fulfilled" && result.value.response.ok) {
      const region = result.value.region;
      log.info(`Shard discovery success: ${region.toUpperCase()} for ${tokens.puuid.substring(0, 8)}`);
      cachedShardByPuuid.set(tokens.puuid, region);
      return result.value.response;
    }
  }

  // Retry shards whose probe failed at the network level (timeouts), with a longer timeout
  let lastError: Error | null = null;
  for (const [i, result] of results.entries()) {
    if (result.status === "fulfilled") continue;
    const region = others[i]!;
    log.info(`Fetching store for PUUID: ${tokens.puuid.substring(0, 8)} on shard: ${region.toUpperCase()}`);

    try {
      const response = await fetchWithRetry(endpointBuilder(getPdUrl(region)), baseHeaders, 30_000, false);
      if (response.ok) {
        log.info(`Discovered correct shard: ${region.toUpperCase()}`);
        cachedShardByPuuid.set(tokens.puuid, region);
        return response;
      }
      lastError = new Error(`Request failed with status ${response.status}`);
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
  // Only the v3 storefront is POST; other v3 endpoints (e.g. playerloadout) are GET
  const isPost = url.includes("/store/v3/storefront/");
  const method = isPost ? "POST" : "GET";
  const body = isPost ? "{}" : undefined;
  const headers = isPost
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
