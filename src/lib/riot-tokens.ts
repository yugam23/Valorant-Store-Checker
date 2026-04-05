/**
 * Riot Token Utilities
 *
 * URL constants, request headers, token extraction, and region resolution.
 * Extracted from riot-auth.ts (Phase 10 decomposition).
 */

import { UserInfo } from "./riot-auth";
import { parseWithLog } from "@/lib/schemas/parse";
import { EntitlementsResponseSchema, UserInfoSchema } from "@/lib/schemas/riot-auth";

export { determineRegion } from "@/lib/region-utils";

// Riot API base URL — configurable for E2E testing via MSW mock server
export const RIOT_API_BASE = process.env.RIOT_API_BASE ?? "https://auth.riotgames.com";

export const RIOT_AUTH_URL = `${RIOT_API_BASE}/api/v1/authorization`;
// Entitlements uses a separate subdomain, not a path under auth.riotgames.com
export const RIOT_ENTITLEMENTS_URL = `https://entitlements.auth.riotgames.com/api/token/v1`;
export const RIOT_USERINFO_URL = `${RIOT_API_BASE}/userinfo`;

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
 * Per-request header factory for Riot auth requests.
 * Matches RadiantConnect's header set: Riot Client UA + baggage + traceparent.
 *
 * Generates fresh tracing IDs (baggage, traceparent) on every call — this is
 * correct because each call represents a distinct request context. Call this
 * once per outgoing request rather than sharing a single header object.
 */
export function createRiotHeaders(
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

/** @deprecated Use createRiotHeaders — kept for backwards compatibility */
export const riotHeaders = createRiotHeaders;

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
      signal: AbortSignal.timeout(30_000),
    });

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    const parsed = parseWithLog(EntitlementsResponseSchema, data, "EntitlementsResponse");
    return parsed?.entitlements_token ?? null;
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
      signal: AbortSignal.timeout(30_000),
    });

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    return parseWithLog(UserInfoSchema, data, "UserInfo") as UserInfo | null;
  } catch {
    return null;
  }
}

