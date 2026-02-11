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

const RIOT_AUTH_URL = "https://auth.riotgames.com/api/v1/authorization";
const RIOT_ENTITLEMENTS_URL = "https://entitlements.auth.riotgames.com/api/token/v1";
const RIOT_USERINFO_URL = "https://auth.riotgames.com/userinfo";

const CLIENT_ID = "play-valorant-web-prod";
const REDIRECT_URI = "https://playvalorant.com/opt_in";

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
 * Initiates the authentication flow with Riot Games
 * @param username Riot ID (username#tagline)
 * @param password Account password
 * @returns Authentication response with tokens or MFA requirement
 */
export async function authenticateRiotAccount(
  username: string,
  password: string
): Promise<
  | { success: true; tokens: AuthTokens }
  | { success: false; type: "multifactor"; cookie: string; multifactor?: AuthResponse["multifactor"] }
  | { success: false; error: string }
> {
  try {
    // Step 1: Initialize authorization session
    const initResponse = await fetch(RIOT_AUTH_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        client_id: CLIENT_ID,
        nonce: "1",
        redirect_uri: REDIRECT_URI,
        response_type: "token id_token",
        scope: "account openid",
      }),
    });

    if (!initResponse.ok) {
      return {
        success: false,
        error: `Failed to initialize auth session: ${initResponse.statusText}`,
      };
    }

    // Extract session cookie
    const cookies = initResponse.headers.get("set-cookie");
    if (!cookies) {
      return {
        success: false,
        error: "No session cookie received from auth initialization",
      };
    }

    // Step 2: Submit credentials
    const authResponse = await fetch(RIOT_AUTH_URL, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Cookie: cookies,
      },
      body: JSON.stringify({
        type: "auth",
        username,
        password,
        remember: true,
      }),
    });

    if (!authResponse.ok) {
      return {
        success: false,
        error: `Authentication failed: ${authResponse.statusText}`,
      };
    }

    const authData: AuthResponse = await authResponse.json();

    // Step 3: Handle MFA if required
    if (authData.type === "multifactor") {
      return {
        success: false,
        type: "multifactor",
        cookie: cookies,
        multifactor: authData.multifactor,
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

    return {
      success: true,
      tokens: {
        accessToken: tokens.accessToken,
        idToken: tokens.idToken,
        entitlementsToken,
        puuid: userInfo.sub,
        region,
      },
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
  | { success: true; tokens: AuthTokens }
  | { success: false; error: string }
> {
  try {
    const mfaResponse = await fetch(RIOT_AUTH_URL, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Cookie: cookie,
      },
      body: JSON.stringify({
        type: "multifactor",
        code,
        rememberDevice: true,
      }),
    });

    if (!mfaResponse.ok) {
      return {
        success: false,
        error: `MFA submission failed: ${mfaResponse.statusText}`,
      };
    }

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

    return {
      success: true,
      tokens: {
        accessToken: tokens.accessToken,
        idToken: tokens.idToken,
        entitlementsToken,
        puuid: userInfo.sub,
        region,
      },
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
function extractTokensFromUri(uri: string): { accessToken: string; idToken: string } | null {
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
async function getEntitlementsToken(accessToken: string): Promise<string | null> {
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
async function getUserInfo(accessToken: string): Promise<UserInfo | null> {
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
function determineRegion(userInfo: UserInfo): string {
  // Try to get region from affinity if available
  if (userInfo.affinity && userInfo.affinity.pbe) {
    return userInfo.affinity.pbe;
  }

  // Fallback to country-based mapping
  const countryToRegion: { [key: string]: string } = {
    // North America
    US: "na",
    CA: "na",
    MX: "na",

    // Europe
    GB: "eu",
    DE: "eu",
    FR: "eu",
    IT: "eu",
    ES: "eu",
    RU: "eu",
    TR: "eu",
    PL: "eu",
    NL: "eu",
    SE: "eu",
    NO: "eu",
    DK: "eu",
    FI: "eu",

    // Asia Pacific
    JP: "ap",
    KR: "kr",
    CN: "ap",
    TW: "ap",
    HK: "ap",
    SG: "ap",
    TH: "ap",
    VN: "ap",
    ID: "ap",
    MY: "ap",
    PH: "ap",
    IN: "ap",
    AU: "ap",
    NZ: "ap",

    // Latin America
    BR: "br",
    AR: "latam",
    CL: "latam",
    CO: "latam",
    PE: "latam",
  };

  return countryToRegion[userInfo.country] || "na";
}
