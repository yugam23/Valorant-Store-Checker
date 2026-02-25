/**
 * Riot SSID Re-Authentication
 *
 * Refreshes Riot tokens using stored session cookies (SSID re-auth).
 * Extracted from riot-auth.ts (Phase 10 decomposition).
 */

import { createLogger } from "./logger";
import { mergeCookies, extractNamedCookies, buildEssentialCookieString, captureSetCookies } from "./riot-cookies";
import {
  extractTokensFromUri,
  getEntitlementsToken,
  getUserInfo,
  determineRegion,
  randomHex,
  RIOT_AUTH_URL,
  CLIENT_ID,
  REDIRECT_URI,
  RIOT_CLIENT_UA,
} from "./riot-tokens";
import type { AuthTokens, RiotSessionCookies } from "./riot-auth";

const log = createLogger("riot-reauth");

/**
 * Completes SSID re-auth by extracting tokens + entitlements + user info
 * from a successful auth response URI.
 *
 * Preserves the ORIGINAL ssid cookie: Riot's auth response returns a
 * short-lived session ssid, but the user's original "remember-me" ssid
 * stays valid for ~30 days and must be kept for future refreshes.
 */
async function completeRefresh(
  uri: string,
  originalNamed: RiotSessionCookies,
  responseCookies: string,
): Promise<
  | {
      success: true;
      tokens: AuthTokens;
      riotCookies: string;
      namedCookies: RiotSessionCookies;
    }
  | { success: false; error: string }
> {
  const tokens = extractTokensFromUri(uri);
  if (!tokens) {
    return {
      success: false,
      error: "Failed to extract tokens from re-auth URI",
    };
  }

  const entitlementsToken = await getEntitlementsToken(tokens.accessToken);
  if (!entitlementsToken) {
    return {
      success: false,
      error: "Failed to get entitlements after re-auth",
    };
  }

  const userInfo = await getUserInfo(tokens.accessToken);
  if (!userInfo) {
    return { success: false, error: "Failed to get user info after re-auth" };
  }

  const region = determineRegion(userInfo);

  // Merge response cookies but KEEP the original ssid —
  // Riot's POST/GET response sets a short-lived session ssid that expires
  // quickly, while the original "remember-me" ssid is valid for ~30 days.
  const responseNamed = extractNamedCookies(responseCookies);
  const preservedNamed: RiotSessionCookies = {
    ...responseNamed,
    ssid: originalNamed.ssid, // Keep original long-lived ssid
    raw: responseCookies,
  };
  const preservedCookies = buildEssentialCookieString(preservedNamed);

  log.info("SSID re-auth successful (preserved original ssid)");

  return {
    success: true,
    tokens: {
      accessToken: tokens.accessToken,
      idToken: tokens.idToken,
      entitlementsToken,
      puuid: userInfo.sub,
      region,
      gameName: userInfo.acct?.game_name,
      tagLine: userInfo.acct?.tag_line,
      country: userInfo.country,
    },
    riotCookies: preservedCookies,
    namedCookies: preservedNamed,
  };
}

/**
 * Refreshes Riot tokens using stored session cookies (SSID re-auth).
 *
 * Two-method approach:
 * 1. POST to /api/v1/authorization with SSID cookie — standard API re-auth
 * 2. If POST returns type != "response", fall back to GET /authorize
 *    (browser-style OAuth redirect) which Riot handles differently
 *
 * After success, the ORIGINAL ssid is preserved (not replaced by the
 * response's short-lived session ssid) so future refreshes keep working.
 *
 * @param riotCookies Stored Riot session cookies from a previous login
 * @returns Fresh tokens + updated cookies, or error
 */
export async function refreshTokensWithCookies(riotCookies: string): Promise<
  | {
      success: true;
      tokens: AuthTokens;
      riotCookies: string;
      namedCookies: RiotSessionCookies;
    }
  | { success: false; error: string }
> {
  try {
    const named = extractNamedCookies(riotCookies);

    if (!named.ssid) {
      return {
        success: false,
        error: "No SSID cookie available for re-auth — full login required",
      };
    }

    log.info(
      "SSID re-auth: ssid=%s, clid=%s, csid=%s, tdid=%s",
      named.ssid ? "present" : "missing",
      named.clid ? "present" : "missing",
      named.csid ? "present" : "missing",
      named.tdid ? "present" : "missing",
    );

    // ── Attempt: GET /authorize (Cookie Reauth) ──
    // Documentation: https://valapidocs.techchrism.me/endpoint/cookie-reauth
    // Use standard browser User-Agent and specific scope "account openid"

    const BROWSER_UA =
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36";

    const authorizeParams = new URLSearchParams({
      client_id: CLIENT_ID,
      redirect_uri: REDIRECT_URI,
      response_type: "token id_token",
      nonce: randomHex(16),
      scope: "account openid",
    });

    const getResponse = await fetch(
      `https://auth.riotgames.com/authorize?${authorizeParams}`,
      {
        method: "GET",
        headers: {
          Cookie: riotCookies,
          "User-Agent": RIOT_CLIENT_UA,
        },
        redirect: "manual",
      },
    );

    const getSetCookies = captureSetCookies(getResponse);
    const getMerged = mergeCookies(riotCookies, getSetCookies);

    // Check for correct redirect to playvalorant.com
    if (
      getResponse.status === 303 ||
      getResponse.status === 302 ||
      getResponse.status === 301
    ) {
      const location = getResponse.headers.get("location");

      if (location?.includes("access_token")) {
        return await completeRefresh(location, named, getMerged);
      }

      // If redirected to login page, the session is invalid
      if (location?.includes("authenticate.riotgames.com/login")) {
        log.warn(
          "GET /authorize redirected to login page — session likely expired/invalid.",
        );
        return {
          success: false,
          error: "Session expired (redirected to login)",
        };
      }

      log.warn(
        "GET /authorize redirected to unexpected location: %s",
        location?.split("#")[0] || "(no location)",
      );
    } else {
      log.warn(
        "GET /authorize returned status %d (expected 302/303)",
        getResponse.status,
      );
    }

    return {
      success: false,
      error: `SSID re-auth failed with status ${getResponse.status}`,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "SSID re-auth failed",
    };
  }
}
