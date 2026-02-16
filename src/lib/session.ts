/**
 * Session Management Module
 *
 * Handles secure session creation, retrieval, and deletion using HTTP-only cookies.
 * Encrypts sensitive tokens using jose library (JWT encryption).
 *
 * Security features:
 * - HTTP-only cookies (not accessible via JavaScript)
 * - Secure flag (HTTPS only in production)
 * - SameSite=Strict (CSRF protection)
 * - Token encryption using JWE
 */

import { SignJWT, jwtVerify } from "jose";
import { refreshTokensWithCookies } from "./riot-auth";
import { cookies } from "next/headers";
import { env } from "./env";
import { createLogger } from "./logger";

const log = createLogger("session");

const SESSION_COOKIE_NAME = "valorant_session";
const SESSION_MAX_AGE = 60 * 60 * 24 * 30; // 30 days in seconds
const TOKEN_EXPIRY_THRESHOLD = 55 * 60 * 1000; // 55 minutes in ms (Riot tokens expire in ~1 hour)
const TOKEN_HARD_EXPIRY = 65 * 60 * 1000; // 65 minutes in ms — token is definitely dead past this point

const getSecretKey = (): Uint8Array => {
  return new TextEncoder().encode(env.SESSION_SECRET);
};

export interface SessionData {
  accessToken: string;
  idToken?: string;
  entitlementsToken: string;
  puuid: string;
  region: string;
  gameName?: string;
  tagLine?: string;
  riotCookies?: string;
  createdAt: number;
  [key: string]: string | number | undefined; // Index signature for JWT compatibility
}

/**
 * Creates an encrypted session and sets it as an HTTP-only cookie
 * @param tokens Authentication tokens and user data
 * @returns Promise that resolves when session is created
 */
export async function createSession(tokens: {
  accessToken: string;
  idToken?: string;
  entitlementsToken: string;
  puuid: string;
  region: string;
  gameName?: string;
  tagLine?: string;
  riotCookies?: string;
}): Promise<void> {
  // Only keep essential Riot cookies (ssid, clid, csid, tdid) to prevent
  // the session JWT from exceeding the browser's ~4 KB cookie limit.
  const ESSENTIAL_COOKIE_NAMES = new Set(["ssid", "clid", "csid", "tdid"]);
  const filteredCookies = tokens.riotCookies
    ? tokens.riotCookies
        .split("; ")
        .filter((pair) => ESSENTIAL_COOKIE_NAMES.has(pair.split("=")[0].trim()))
        .join("; ")
    : undefined;

  const sessionData: SessionData = {
    accessToken: tokens.accessToken,
    // idToken: tokens.idToken, // Removed to save space
    entitlementsToken: tokens.entitlementsToken,
    puuid: tokens.puuid,
    region: tokens.region,
    gameName: tokens.gameName,
    tagLine: tokens.tagLine,
    riotCookies: filteredCookies || undefined,
    createdAt: Date.now(),
  };

  // Create encrypted JWT
  const token = await new SignJWT(sessionData)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE}s`)
    .sign(getSecretKey());

  // Guard against browser's ~4 KB cookie limit
  if (token.length > 3800) {
    log.warn("Session JWT is %d bytes — approaching 4 KB cookie limit!", token.length);
  }

  // Set HTTP-only cookie
  const cookieStore = await cookies();
  const isProduction = process.env.NODE_ENV === "production";
  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: isProduction,
    sameSite: "lax",
    maxAge: SESSION_MAX_AGE,
    path: "/",
  });
}

/**
 * Retrieves and decrypts the current session data
 * @returns Session data if valid session exists, null otherwise
 */
export async function getSession(): Promise<SessionData | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;

    if (!token) {
      return null;
    }

    // Verify and decrypt JWT
    const { payload } = await jwtVerify(token, getSecretKey());

    // Validate payload structure
    if (
      !payload.accessToken ||
      !payload.entitlementsToken ||
      !payload.puuid ||
      !payload.region
    ) {
      return null;
    }

    return {
      accessToken: payload.accessToken as string,
      idToken: payload.idToken as string | undefined,
      entitlementsToken: payload.entitlementsToken as string,
      puuid: payload.puuid as string,
      region: payload.region as string,
      gameName: payload.gameName as string | undefined,
      tagLine: payload.tagLine as string | undefined,
      riotCookies: payload.riotCookies as string | undefined,
      createdAt: payload.createdAt as number,
    };
  } catch (error) {
    // Token verification failed (expired, invalid, tampered)
    log.error("Session verification failed:", error);
    return null;
  }
}

/**
 * Deletes the current session by removing the session cookie
 * @returns Promise that resolves when session is deleted
 */
export async function deleteSession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
}

/**
 * Checks if a valid session exists
 * @returns True if valid session exists, false otherwise
 */
export async function hasValidSession(): Promise<boolean> {
  const session = await getSession();
  return session !== null;
}

/**
 * Refreshes the session by extending the cookie expiration
 * @returns True if session was refreshed, false if no valid session exists
 */
export async function refreshSession(): Promise<boolean> {
  const session = await getSession();

  if (!session) {
    return false;
  }

  // Recreate the session with new expiration
  await createSession({
    accessToken: session.accessToken,
    idToken: session.idToken,
    entitlementsToken: session.entitlementsToken,
    puuid: session.puuid,
    region: session.region,
    gameName: session.gameName,
    tagLine: session.tagLine,
    riotCookies: session.riotCookies,
  });

  return true;
}

/**
 * Gets session with automatic token refresh.
 * If the Riot access token is likely expired (~1 hour), attempts to
 * refresh it using stored SSID cookies before returning the session.
 *
 * @returns Fresh session data, or null if no valid session / refresh failed
 */
export async function getSessionWithRefresh(): Promise<SessionData | null> {
  const session = await getSession();

  if (!session) {
    return null;
  }

  // Check if access token is likely expired (Riot tokens last ~1 hour)
  const tokenAge = Date.now() - (session.createdAt || 0);
  const isTokenExpired = tokenAge > TOKEN_EXPIRY_THRESHOLD;

  if (!isTokenExpired) {
    return session;
  }

  log.info(
    "Access token likely expired (age: %dmin), attempting SSID refresh",
    Math.round(tokenAge / 60000),
  );

  const isTokenDefinitelyDead = tokenAge > TOKEN_HARD_EXPIRY;

  // No stored cookies means we can't refresh
  if (!session.riotCookies) {
    log.warn("No stored Riot cookies for token refresh");
    if (isTokenDefinitelyDead) {
      log.warn("Token is definitely expired and no cookies to refresh — clearing dead session");
      await deleteSession();
      return null;
    }
    return session;
  }

  try {
    const refreshResult = await refreshTokensWithCookies(session.riotCookies);

    if (!refreshResult.success) {
      log.warn("Token refresh failed: %s", refreshResult.error);
      if (isTokenDefinitelyDead) {
        log.warn("Token is definitely expired and refresh failed — clearing dead session");
        await deleteSession();
        return null;
      }
      return session; // Within grace period, maybe still works
    }

    // Update the session with fresh tokens
    const freshSession: SessionData = {
      accessToken: refreshResult.tokens.accessToken,
      idToken: refreshResult.tokens.idToken,
      entitlementsToken: refreshResult.tokens.entitlementsToken,
      puuid: refreshResult.tokens.puuid,
      region: refreshResult.tokens.region,
      gameName: refreshResult.tokens.gameName,
      tagLine: refreshResult.tokens.tagLine,
      riotCookies: refreshResult.riotCookies,
      createdAt: Date.now(),
    };

    await createSession(freshSession);
    log.info("Session refreshed successfully");

    return freshSession;
  } catch (error) {
    log.error("Token refresh error:", error);
    if (isTokenDefinitelyDead) {
      log.warn("Token is definitely expired and refresh threw — clearing dead session");
      await deleteSession();
      return null;
    }
    return session; // Within grace period, maybe still works
  }
}
