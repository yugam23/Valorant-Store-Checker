/**
 * Riot Token Utilities
 *
 * URL constants, request headers, token extraction, and region resolution.
 * Extracted from riot-auth.ts (Phase 10 decomposition).
 */

import { createLogger } from "./logger";
import { UserInfo } from "./riot-auth";

const log = createLogger("riot-tokens");

export const RIOT_AUTH_URL = "https://auth.riotgames.com/api/v1/authorization";
export const RIOT_ENTITLEMENTS_URL =
  "https://entitlements.auth.riotgames.com/api/token/v1";
export const RIOT_USERINFO_URL = "https://auth.riotgames.com/userinfo";

export const CLIENT_ID = "play-valorant-web-prod";
export const REDIRECT_URI = "https://playvalorant.com/opt_in";

// Riot Client user-agent from RadiantConnect — mimics the actual Riot Client SDK
// instead of a browser, which reduces bot-detection / captcha triggering.
export const RIOT_CLIENT_UA =
  "RiotGamesApi/24.11.0.4602 rso-auth (Windows;10;;Professional, x64) riot_client/0";

// Broader scope matching RadiantConnect's SSID re-auth flow
export const AUTH_SCOPE =
  "account openid ban link lol_region lol summoner offline_access";

/** Generate a random hex string for nonce / trace IDs */
export function randomHex(bytes: number): string {
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);
  return Array.from(arr, (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Generate a W3C traceparent header like RadiantConnect */
export function generateTraceParent(): string {
  const traceId = randomHex(16);
  const parentId = randomHex(8);
  return `00-${traceId}-${parentId}-00`;
}

/**
 * Common headers for Riot auth requests.
 * Matches RadiantConnect's header set: Riot Client UA + baggage + traceparent.
 */
export function riotHeaders(
  extra: Record<string, string> = {},
): Record<string, string> {
  return {
    "Content-Type": "application/json",
    "User-Agent": RIOT_CLIENT_UA,
    Accept: "application/json",
    "Accept-Encoding": "deflate, gzip, zstd",
    Connection: "keep-alive",
    baggage: `sdksid=${randomHex(16)}`,
    traceparent: generateTraceParent(),
    ...extra,
  };
}

/**
 * Extracts access_token and id_token from redirect URI fragment
 * @param uri Redirect URI containing tokens in fragment
 * @returns Object with access and ID tokens, or null if extraction fails
 */
export function extractTokensFromUri(
  uri: string,
): { accessToken: string; idToken: string } | null {
  try {
    const url = new URL(uri);
    const fragment = url.hash.substring(1); // Remove the # character
    const params = new URLSearchParams(fragment);

    const accessToken = params.get("access_token");
    const idToken = params.get("id_token");

    if (!accessToken || !idToken) {
      return null;
    }

    return { accessToken, idToken };
  } catch {
    return null;
  }
}

/**
 * Retrieves entitlements token using access token
 * @param accessToken Bearer token from authentication
 * @returns Entitlements token string or null if request fails
 */
export async function getEntitlementsToken(
  accessToken: string,
): Promise<string | null> {
  try {
    const response = await fetch(RIOT_ENTITLEMENTS_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({}),
    });

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    return data.entitlements_token || null;
  } catch {
    return null;
  }
}

/**
 * Retrieves user information including PUUID
 * @param accessToken Bearer token from authentication
 * @returns User info object or null if request fails
 */
export async function getUserInfo(
  accessToken: string,
): Promise<UserInfo | null> {
  try {
    const response = await fetch(RIOT_USERINFO_URL, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      return null;
    }

    const data: UserInfo = await response.json();
    return data;
  } catch {
    return null;
  }
}

/**
 * Determines the game region/shard from user information
 * @param userInfo User information object
 * @returns Region identifier (na, eu, ap, kr, latam, br)
 */
export function determineRegion(userInfo: UserInfo): string {
  log.debug(
    "Determining region. Country:",
    userInfo.country,
    "Affinity:",
    JSON.stringify(userInfo.affinity),
  );

  // Primary: use the affinity field which contains the actual shard assignment
  // The "pp" key (player platform) maps directly to the PD shard
  if (userInfo.affinity) {
    const shard =
      userInfo.affinity.pp ||
      userInfo.affinity.live ||
      Object.values(userInfo.affinity)[0];
    if (shard) {
      log.info(`Using affinity shard: ${shard}`);
      return shard;
    }
  }

  // Fallback to country-based mapping
  // Map both 2-letter and 3-letter codes just in case
  const countryToRegion: { [key: string]: string } = {
    // North America
    US: "na",
    USA: "na",
    CA: "na",
    CAN: "na",
    MX: "na",
    MEX: "na",

    // Europe
    GB: "eu",
    GBR: "eu",
    DE: "eu",
    DEU: "eu",
    FR: "eu",
    FRA: "eu",
    IT: "eu",
    ITA: "eu",
    ES: "eu",
    ESP: "eu",
    RU: "eu",
    RUS: "eu",
    TR: "eu",
    TUR: "eu",
    PL: "eu",
    POL: "eu",
    NL: "eu",
    NLD: "eu",
    SE: "eu",
    SWE: "eu",
    NO: "eu",
    NOR: "eu",
    DK: "eu",
    DNK: "eu",
    FI: "eu",
    FIN: "eu",
    UA: "eu",
    UKR: "eu",

    // Asia Pacific
    JP: "ap",
    JPN: "ap",
    KR: "kr",
    KOR: "kr",
    CN: "ap",
    CHN: "ap",
    TW: "ap",
    TWN: "ap",
    HK: "ap",
    HKG: "ap",
    SG: "ap",
    SGP: "ap",
    TH: "ap",
    THA: "ap",
    VN: "ap",
    VNM: "ap",
    ID: "ap",
    IDN: "ap",
    MY: "ap",
    MYS: "ap",
    PH: "ap",
    PHL: "ap",
    IN: "ap",
    IND: "ap",
    AU: "ap",
    AUS: "ap",
    NZ: "ap",
    NZL: "ap",

    // Latin America
    BR: "br",
    BRA: "br",
    AR: "latam",
    ARG: "latam",
    CL: "latam",
    CHL: "latam",
    CO: "latam",
    COL: "latam",
    PE: "latam",
    PER: "latam",
  };

  const countryCode = userInfo.country?.toUpperCase();
  const region = countryToRegion[countryCode];

  if (region) {
    log.info(`Mapped country ${countryCode} to region ${region}`);
    return region;
  }

  log.warn(`Unknown country code: ${countryCode}, defaulting to 'na'`);
  return "na";
}
