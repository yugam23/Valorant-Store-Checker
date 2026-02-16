/**
 * Riot Games Authentication Module
 *
 * Handles authentication flow with Riot Games API including:
 * - Initial authorization
 * - Credential submission
 * - MFA handling
 * - Token extraction and entitlement retrieval
 * - User info fetching (PUUID, Region)
 *
 * Security: This module runs server-side only. Never expose tokens to client.
 */

import { createLogger } from "./logger";

const log = createLogger("riot-auth");

const RIOT_AUTH_URL = "https://auth.riotgames.com/api/v1/authorization";
const RIOT_ENTITLEMENTS_URL = "https://entitlements.auth.riotgames.com/api/token/v1";
const RIOT_USERINFO_URL = "https://auth.riotgames.com/userinfo";

const CLIENT_ID = "play-valorant-web-prod";
const REDIRECT_URI = "https://playvalorant.com/opt_in";

// Riot Client user-agent from RadiantConnect — mimics the actual Riot Client SDK
// instead of a browser, which reduces bot-detection / captcha triggering.
const RIOT_CLIENT_UA =
  "RiotGamesApi/24.11.0.4602 rso-auth (Windows;10;;Professional, x64) riot_client/0";

// Broader scope matching RadiantConnect's SSID re-auth flow
const AUTH_SCOPE = "account openid ban link lol_region lol summoner offline_access";

/** Generate a random hex string for nonce / trace IDs */
function randomHex(bytes: number): string {
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);
  return Array.from(arr, (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Generate a W3C traceparent header like RadiantConnect */
function generateTraceParent(): string {
  const traceId = randomHex(16);
  const parentId = randomHex(8);
  return `00-${traceId}-${parentId}-00`;
}

/**
 * Common headers for Riot auth requests.
 * Matches RadiantConnect's header set: Riot Client UA + baggage + traceparent.
 */
function riotHeaders(extra: Record<string, string> = {}): Record<string, string> {
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

export interface AuthResponse {
  type: "response" | "multifactor";
  response?: {
    mode?: string;
    parameters?: {
      uri?: string;
    };
  };
  multifactor?: {
    email?: string;
    method?: string;
    methods?: string[];
    multiFactorCodeLength?: number;
  };
  country?: string;
}

export interface AuthTokens {
  accessToken: string;
  idToken: string;
  entitlementsToken: string;
  puuid: string;
  region: string;
  gameName?: string;
  tagLine?: string;
  riotCookies?: string;
}

/**
 * Individual Riot session cookies extracted from Set-Cookie headers.
 * These are the critical cookies RadiantConnect tracks for SSID re-auth.
 */
export interface RiotSessionCookies {
  ssid?: string;
  clid?: string;
  csid?: string;
  tdid?: string;
  raw: string; // The full cookie string for backward compat
}

export interface UserInfo {
  country: string;
  sub: string; // PUUID
  email_verified: boolean;
  player_plocale?: string;
  country_at?: number;
  pw?: {
    cng_at: number;
    reset: boolean;
    must_reset: boolean;
  };
  phone_number_verified: boolean;
  account_verified: boolean;
  ppid?: string;
  player_locale?: string;
  acct?: {
    type: number;
    state: string;
    adm: boolean;
    game_name: string;
    tag_line: string;
    created_at: number;
  };
  age: number;
  jti: string;
  affinity?: {
    [key: string]: string;
  };
}

/**
 * Generates the Riot Login URL for browser-based authentication
 */
export function getRiotLoginUrl(): string {
  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    response_type: "token id_token",
    scope: AUTH_SCOPE,
    nonce: randomHex(16),
  });
  return `${RIOT_AUTH_URL}?${params.toString()}`;
}

export interface CompleteAuthResult {
  success: boolean;
  tokens?: AuthTokens;
  error?: string;
}

/**
 * Processes the redirect URL from browser login to complete authentication
 * @param url The full redirect URL containing access_token in hash
 */
export async function completeAuthWithUrl(url: string): Promise<
  | { success: true; tokens: AuthTokens }
  | { success: false; error: string }
> {
  try {
    let hash = "";
    if (url.includes("#")) {
      hash = url.split("#")[1];
    } else {
      hash = url; 
    }

    const params = new URLSearchParams(hash);
    const accessToken = params.get("access_token");
    const idToken = params.get("id_token");

    if (!accessToken || !idToken) {
      return { success: false, error: "Invalid URL: Missing access_token or id_token" };
    }

    const entitlementsToken = await getEntitlementsToken(accessToken);
    if (!entitlementsToken) {
      return { success: false, error: "Failed to retrieve entitlements token" };
    }

    const userInfo = await getUserInfo(accessToken);
    if (!userInfo) {
      return { success: false, error: "Failed to retrieve user information" };
    }

    const region = determineRegion(userInfo);

    return {
      success: true,
      tokens: {
        accessToken,
        idToken,
        entitlementsToken,
        puuid: userInfo.sub,
        region,
        gameName: userInfo.acct?.game_name,
        tagLine: userInfo.acct?.tag_line,
      },
    };
  } catch (error) {
    return {
       success: false,
       error: error instanceof Error ? error.message : "Failed to process auth URL",
    };
  }
}

export async function authenticateRiotAccount(
  username: string,
  password: string
): Promise<
  | { success: true; tokens: AuthTokens; riotCookies: string; namedCookies: RiotSessionCookies }
  | { success: false; type: "multifactor"; cookie: string; multifactor?: AuthResponse["multifactor"] }
  | { success: false; error: string }
> {
  try {
    // Step 1: Initialize authorization session
    const initResponse = await fetch(RIOT_AUTH_URL, {
      method: "POST",
      headers: riotHeaders(),
      body: JSON.stringify({
        acr_values: "",
        client_id: CLIENT_ID,
        nonce: randomHex(16),
        redirect_uri: REDIRECT_URI,
        response_type: "token id_token",
        scope: AUTH_SCOPE,
      }),
      cache: "no-store",
    });

    log.info("Step 1 - Init status:", initResponse.status);

    if (!initResponse.ok) {
      return {
        success: false,
        error: `Failed to initialize auth session: ${initResponse.statusText}`,
      };
    }

    // Extract session cookies properly
    const setCookieHeaders = initResponse.headers.getSetCookie();
    if (!setCookieHeaders || setCookieHeaders.length === 0) {
      return {
        success: false,
        error: "No session cookie received from auth initialization",
      };
    }
    const cookies = setCookieHeaders
      .map((c) => c.split(";")[0])
      .join("; ");

    log.debug("Step 1 - Cookie names:", setCookieHeaders.map((c) => c.split("=")[0]).join(", "));

    // Step 2: Submit credentials
    const authResponse = await fetch(RIOT_AUTH_URL, {
      method: "PUT",
      headers: riotHeaders({ Cookie: cookies }),
      body: JSON.stringify({
        type: "auth",
        username,
        password,
        language: "en_US",
        region: null,
        remember: true,
      }),
      cache: "no-store",
    });

    log.info("Step 2 - Auth status:", authResponse.status);

    if (!authResponse.ok) {
      // Read the body for more context on failures
      const errorBody = await authResponse.text();
      log.warn("Step 2 - Error body:", errorBody);
      return {
        success: false,
        error: `Authentication failed: ${authResponse.status} ${authResponse.statusText}`,
      };
    }

    // Merge cookies from credential response
    const authSetCookies = authResponse.headers.getSetCookie();
    const allCookies = mergeCookies(cookies, authSetCookies);

    const authData: AuthResponse = await authResponse.json();

    log.debug("Step 2 - Full response:", JSON.stringify(authData));

    // Step 3: Handle MFA if required
    if (authData.type === "multifactor") {
      return {
        success: false,
        type: "multifactor",
        cookie: allCookies,
        multifactor: authData.multifactor,
      };
    }

    // Step 3b: Handle auth failure
    if (authData.type !== "response") {
      const errorDetail = (authData as any).error || "Unknown authentication error";
      const country = authData.country ? ` (Region: ${authData.country})` : "";
      return {
        success: false,
        error: `Riot Auth Error: ${errorDetail}${country}`,
      };
    }

    // Step 4: Extract tokens from redirect URI
    const uri = authData.response?.parameters?.uri;
    if (!uri) {
      return {
        success: false,
        error: "No redirect URI received in response",
      };
    }

    const tokens = extractTokensFromUri(uri);
    if (!tokens) {
      return {
        success: false,
        error: "Failed to extract tokens from redirect URI",
      };
    }

    // Step 5: Get Entitlements Token
    const entitlementsToken = await getEntitlementsToken(tokens.accessToken);
    if (!entitlementsToken) {
      return {
        success: false,
        error: "Failed to retrieve entitlements token",
      };
    }

    // Step 6: Get User Info (PUUID & Region)
    const userInfo = await getUserInfo(tokens.accessToken);
    if (!userInfo) {
      return {
        success: false,
        error: "Failed to retrieve user information",
      };
    }

    // Determine region from user info
    const region = determineRegion(userInfo);

    // Extract individual Riot cookies (ssid, clid, csid, tdid) for SSID re-auth
    const namedCookies = extractNamedCookies(allCookies);
    log.debug("Extracted named cookies:", {
      ssid: namedCookies.ssid ? "present" : "missing",
      clid: namedCookies.clid ? "present" : "missing",
      csid: namedCookies.csid ? "present" : "missing",
      tdid: namedCookies.tdid ? "present" : "missing",
    });

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
      },
      riotCookies: allCookies,
      namedCookies,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error occurred",
    };
  }
}

/**
 * Submits MFA code to complete authentication
 * @param code 6-digit MFA code
 * @param cookie Session cookie from initial auth attempt
 * @returns Authentication tokens if successful
 */
export async function submitMfa(
  code: string,
  cookie: string
): Promise<
  | { success: true; tokens: AuthTokens; riotCookies: string; namedCookies: RiotSessionCookies }
  | { success: false; error: string }
> {
  try {
    const mfaResponse = await fetch(RIOT_AUTH_URL, {
      method: "PUT",
      headers: riotHeaders({ Cookie: cookie }),
      body: JSON.stringify({
        type: "multifactor",
        code,
        rememberDevice: true,
      }),
      cache: "no-store",
    });

    if (!mfaResponse.ok) {
      return {
        success: false,
        error: `MFA submission failed: ${mfaResponse.statusText}`,
      };
    }

    // Merge cookies from MFA response
    const mfaSetCookies = mfaResponse.headers.getSetCookie();
    const allCookies = mergeCookies(cookie, mfaSetCookies);

    const mfaData: AuthResponse = await mfaResponse.json();

    // Extract tokens from redirect URI
    const uri = mfaData.response?.parameters?.uri;
    if (!uri) {
      return {
        success: false,
        error: "No redirect URI received after MFA",
      };
    }

    const tokens = extractTokensFromUri(uri);
    if (!tokens) {
      return {
        success: false,
        error: "Failed to extract tokens from redirect URI",
      };
    }

    // Get Entitlements Token
    const entitlementsToken = await getEntitlementsToken(tokens.accessToken);
    if (!entitlementsToken) {
      return {
        success: false,
        error: "Failed to retrieve entitlements token",
      };
    }

    // Get User Info
    const userInfo = await getUserInfo(tokens.accessToken);
    if (!userInfo) {
      return {
        success: false,
        error: "Failed to retrieve user information",
      };
    }

    const region = determineRegion(userInfo);
    const namedCookies = extractNamedCookies(allCookies);

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
      },
      riotCookies: allCookies,
      namedCookies,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error occurred",
    };
  }
}

/**
 * Extracts access_token and id_token from redirect URI fragment
 * @param uri Redirect URI containing tokens in fragment
 * @returns Object with access and ID tokens, or null if extraction fails
 */
export function extractTokensFromUri(uri: string): { accessToken: string; idToken: string } | null {
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
export async function getEntitlementsToken(accessToken: string): Promise<string | null> {
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
export async function getUserInfo(accessToken: string): Promise<UserInfo | null> {
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
 * Merges existing cookies with new set-cookie headers.
 * New cookies with the same name override old ones.
 */
function mergeCookies(existing: string, newSetCookieHeaders: string[]): string {
  const cookieMap = new Map<string, string>();

  // Parse existing cookies
  for (const pair of existing.split("; ")) {
    const eqIdx = pair.indexOf("=");
    if (eqIdx > 0) {
      cookieMap.set(pair.substring(0, eqIdx), pair);
    }
  }

  // Override with new cookies
  for (const header of newSetCookieHeaders) {
    const cookiePart = header.split(";")[0];
    const eqIdx = cookiePart.indexOf("=");
    if (eqIdx > 0) {
      cookieMap.set(cookiePart.substring(0, eqIdx), cookiePart);
    }
  }

  return Array.from(cookieMap.values()).join("; ");
}

/**
 * Extracts individual named Riot cookies from a raw cookie string.
 * RadiantConnect tracks ssid, clid, csid, tdid separately for SSID re-auth.
 */
function extractNamedCookies(cookieString: string): RiotSessionCookies {
  const result: RiotSessionCookies = { raw: cookieString };
  for (const pair of cookieString.split("; ")) {
    const eqIdx = pair.indexOf("=");
    if (eqIdx <= 0) continue;
    const name = pair.substring(0, eqIdx).trim();
    const value = pair.substring(eqIdx + 1);
    switch (name) {
      case "ssid": result.ssid = value; break;
      case "clid": result.clid = value; break;
      case "csid": result.csid = value; break;
      case "tdid": result.tdid = value; break;
    }
  }
  return result;
}

/**
 * Builds a minimal cookie string from only the essential Riot cookies.
 * Keeping only ssid/clid/csid/tdid prevents the session JWT from growing
 * past the browser's 4 KB cookie limit after repeated refreshes.
 */
function buildEssentialCookieString(named: RiotSessionCookies): string {
  const parts: string[] = [];
  if (named.ssid) parts.push(`ssid=${named.ssid}`);
  if (named.clid) parts.push(`clid=${named.clid}`);
  if (named.csid) parts.push(`csid=${named.csid}`);
  if (named.tdid) parts.push(`tdid=${named.tdid}`);
  return parts.join("; ");
}

/** Helper: safely capture Set-Cookie headers from a fetch response. */
function captureSetCookies(response: Response): string[] {
  try {
    return response.headers.getSetCookie();
  } catch {
    // Fallback: getSetCookie() may not exist in all runtimes
    const raw = response.headers.get("set-cookie");
    if (raw) {
      return raw.split(/,(?=\s*\w+=)/);
    }
    return [];
  }
}

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
  | { success: true; tokens: AuthTokens; riotCookies: string; namedCookies: RiotSessionCookies }
  | { success: false; error: string }
> {
  const tokens = extractTokensFromUri(uri);
  if (!tokens) {
    return { success: false, error: "Failed to extract tokens from re-auth URI" };
  }

  const entitlementsToken = await getEntitlementsToken(tokens.accessToken);
  if (!entitlementsToken) {
    return { success: false, error: "Failed to get entitlements after re-auth" };
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
export async function refreshTokensWithCookies(
  riotCookies: string
): Promise<
  | { success: true; tokens: AuthTokens; riotCookies: string; namedCookies: RiotSessionCookies }
  | { success: false; error: string }
> {
  try {
    const named = extractNamedCookies(riotCookies);

    if (!named.ssid) {
      return { success: false, error: "No SSID cookie available for re-auth — full login required" };
    }

    log.info("SSID re-auth: ssid=%s, clid=%s, csid=%s, tdid=%s",
      named.ssid ? "present" : "missing",
      named.clid ? "present" : "missing",
      named.csid ? "present" : "missing",
      named.tdid ? "present" : "missing",
    );

    const cookieStr = riotCookies;

    // ── Attempt 1: POST to /api/v1/authorization ──
    const postResponse = await fetch(RIOT_AUTH_URL, {
      method: "POST",
      headers: riotHeaders({ Cookie: cookieStr }),
      body: JSON.stringify({
        acr_values: "",
        client_id: CLIENT_ID,
        nonce: randomHex(16),
        redirect_uri: REDIRECT_URI,
        response_type: "token id_token",
        scope: "account openid",
      }),
      cache: "no-store",
    });

    if (!postResponse.ok) {
      return { success: false, error: `SSID re-auth POST failed: ${postResponse.status}` };
    }

    const postSetCookies = captureSetCookies(postResponse);
    const postMerged = mergeCookies(cookieStr, postSetCookies);

    const postData: AuthResponse = await postResponse.json();

    if (postData.type === "response") {
      const uri = postData.response?.parameters?.uri;
      if (uri) {
        return await completeRefresh(uri, named, postMerged);
      }
      return { success: false, error: "POST returned 'response' but no redirect URI" };
    }

    log.warn("SSID re-auth POST returned type '%s' instead of 'response', trying GET /authorize", postData.type);

    // ── Attempt 2: GET /authorize (browser-style OAuth redirect) ──
    // Riot may honour the SSID cookie on the browser endpoint even when
    // the JSON API endpoint doesn't. Use redirect: "manual" so we can
    // read the Location header containing the token fragment.
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
          Cookie: postMerged, // Include session cookies from POST step
          "User-Agent": RIOT_CLIENT_UA,
        },
        redirect: "manual",
      },
    );

    const getSetCookies = captureSetCookies(getResponse);
    const getMerged = mergeCookies(postMerged, getSetCookies);

    if (getResponse.status === 303 || getResponse.status === 302) {
      const location = getResponse.headers.get("location");
      if (location?.includes("access_token")) {
        return await completeRefresh(location, named, getMerged);
      }
      log.warn("GET /authorize redirected to: %s", location?.split("#")[0] || "(no location)");
    } else {
      log.warn("GET /authorize returned status %d (expected 302/303)", getResponse.status);
    }

    return {
      success: false,
      error: `SSID re-auth failed — POST type: ${postData.type}, GET status: ${getResponse.status}`,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "SSID re-auth failed",
    };
  }
}

/**
 * Determines the game region/shard from user information
 * @param userInfo User information object
 * @returns Region identifier (na, eu, ap, kr, latam, br)
 */
export function determineRegion(userInfo: UserInfo): string {
  log.debug("Determining region. Country:", userInfo.country, "Affinity:", JSON.stringify(userInfo.affinity));

  // Primary: use the affinity field which contains the actual shard assignment
  // The "pp" key (player platform) maps directly to the PD shard
  if (userInfo.affinity) {
    const shard = userInfo.affinity.pp || userInfo.affinity.live || Object.values(userInfo.affinity)[0];
    if (shard) {
      log.info(`Using affinity shard: ${shard}`);
      return shard;
    }
  }

  // Fallback to country-based mapping
  // Map both 2-letter and 3-letter codes just in case
  const countryToRegion: { [key: string]: string } = {
    // North America
    US: "na", USA: "na",
    CA: "na", CAN: "na",
    MX: "na", MEX: "na",

    // Europe
    GB: "eu", GBR: "eu",
    DE: "eu", DEU: "eu",
    FR: "eu", FRA: "eu",
    IT: "eu", ITA: "eu",
    ES: "eu", ESP: "eu",
    RU: "eu", RUS: "eu",
    TR: "eu", TUR: "eu",
    PL: "eu", POL: "eu",
    NL: "eu", NLD: "eu",
    SE: "eu", SWE: "eu",
    NO: "eu", NOR: "eu",
    DK: "eu", DNK: "eu",
    FI: "eu", FIN: "eu",
    UA: "eu", UKR: "eu",

    // Asia Pacific
    JP: "ap", JPN: "ap",
    KR: "kr", KOR: "kr",
    CN: "ap", CHN: "ap",
    TW: "ap", TWN: "ap",
    HK: "ap", HKG: "ap",
    SG: "ap", SGP: "ap",
    TH: "ap", THA: "ap",
    VN: "ap", VNM: "ap",
    ID: "ap", IDN: "ap",
    MY: "ap", MYS: "ap",
    PH: "ap", PHL: "ap",
    IN: "ap", IND: "ap",
    AU: "ap", AUS: "ap",
    NZ: "ap", NZL: "ap",

    // Latin America
    BR: "br", BRA: "br",
    AR: "latam", ARG: "latam",
    CL: "latam", CHL: "latam",
    CO: "latam", COL: "latam",
    PE: "latam", PER: "latam",
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
