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
import { mergeCookies, extractNamedCookies } from "./riot-cookies";
import {
  randomHex,
  riotHeaders,
  extractTokensFromUri,
  getEntitlementsToken,
  getUserInfo,
  determineRegion,
  RIOT_AUTH_URL,
  CLIENT_ID,
  REDIRECT_URI,
  AUTH_SCOPE,
} from "./riot-tokens";

const log = createLogger("riot-auth");

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
  country?: string;
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
export async function completeAuthWithUrl(
  url: string,
): Promise<
  { success: true; tokens: AuthTokens } | { success: false; error: string }
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
      return {
        success: false,
        error: "Invalid URL: Missing access_token or id_token",
      };
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
        country: userInfo.country,
      },
    };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to process auth URL",
    };
  }
}

export async function authenticateRiotAccount(
  username: string,
  password: string,
): Promise<
  | {
      success: true;
      tokens: AuthTokens;
      riotCookies: string;
      namedCookies: RiotSessionCookies;
    }
  | {
      success: false;
      type: "multifactor";
      cookie: string;
      multifactor?: AuthResponse["multifactor"];
    }
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
    const cookies = setCookieHeaders.map((c) => c.split(";")[0]).join("; ");

    log.debug(
      "Step 1 - Cookie names:",
      setCookieHeaders.map((c) => c.split("=")[0]).join(", "),
    );

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
      const errorDetail =
        (authData as any).error || "Unknown authentication error";
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
        country: userInfo.country,
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
  cookie: string,
): Promise<
  | {
      success: true;
      tokens: AuthTokens;
      riotCookies: string;
      namedCookies: RiotSessionCookies;
    }
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
        country: userInfo.country,
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
