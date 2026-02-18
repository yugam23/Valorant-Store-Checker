/**
 * Session Management Module
 *
 * Handles secure session creation, retrieval, and deletion.
 * Migrated to Server-Side Storage with Reference Cookies.
 *
 * Security features:
 * - Session Data stored server-side (JSON Store)
 * - Client receives ONLY a sessionId in the cookie
 * - HTTP-only cookies
 * - Secure flag
 * - SameSite=Lax
 */

import { SignJWT, jwtVerify } from "jose";
import { refreshTokensWithCookies } from "./riot-auth";
import { cookies } from "next/headers";
import { env } from "./env";
import { createLogger } from "./logger";
import { randomUUID } from "crypto";
import { 
  saveSessionToStore, 
  getSessionFromStore, 
  deleteSessionFromStore 
} from "./session-store";
import { SessionData } from "./session-types";

const log = createLogger("session");

const SESSION_COOKIE_NAME = "valorant_session";
const SESSION_MAX_AGE = 60 * 60 * 24 * 30; // 30 days in seconds
const TOKEN_EXPIRY_THRESHOLD = 55 * 60 * 1000; // 55 minutes in ms
const TOKEN_HARD_EXPIRY = 65 * 60 * 1000; // 65 minutes

const getSecretKey = (): Uint8Array => {
  return new TextEncoder().encode(env.SESSION_SECRET);
};

// Export SessionData for other consumers (re-export)
export type { SessionData } from "./session-types";

interface SessionTokenPayload {
  sessionId: string;
  [key: string]: unknown;
}

/**
 * Creates a server-side session and sets a reference cookie
 */
export async function createSession(tokens: {
  accessToken: string;
  idToken?: string;
  entitlementsToken: string;
  puuid: string;
  region: string;
  gameName?: string;
  tagLine?: string;
  country?: string;
  riotCookies?: string;
}): Promise<void> {
  // 1. Filter cookies (legacy logic, still good to keep data small)
  const ESSENTIAL_COOKIE_NAMES = new Set(["ssid", "clid", "csid", "tdid"]);
  const filteredCookies = tokens.riotCookies
    ? tokens.riotCookies
        .split("; ")
        .filter((pair) => ESSENTIAL_COOKIE_NAMES.has(pair.split("=")[0].trim()))
        .join("; ")
    : undefined;

  // 2. Prepare Session Data
  const sessionData: SessionData = {
    accessToken: tokens.accessToken,
    // idToken: tokens.idToken,
    entitlementsToken: tokens.entitlementsToken,
    puuid: tokens.puuid,
    region: tokens.region,
    gameName: tokens.gameName,
    tagLine: tokens.tagLine,
    country: tokens.country,
    riotCookies: filteredCookies || undefined,
    createdAt: Date.now(),
  };

  // 3. Generate Session ID
  const sessionId = randomUUID();

  // 4. Store Session Data Server-Side
  await saveSessionToStore(sessionId, sessionData, SESSION_MAX_AGE);

  // 5. Create Lightweight JWT Payload
  const payload: SessionTokenPayload = { sessionId };

  // 6. Sign JWT
  const token = await new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE}s`)
    .sign(getSecretKey());

  // 7. Set Cookie
  const cookieStore = await cookies();
  const isProduction = process.env.NODE_ENV === "production";
  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: isProduction,
    sameSite: "lax",
    maxAge: SESSION_MAX_AGE,
    path: "/",
  });
  
  log.debug("Created new session %s", sessionId);
}

/**
 * Retrieves session by reference ID from cookie
 */
export async function getSession(): Promise<SessionData | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;

    if (!token) return null;

    // Verify JWT
    const { payload } = await jwtVerify(token, getSecretKey());
    const sessionId = (payload as SessionTokenPayload).sessionId;

    if (!sessionId) {
      log.warn("Invalid session token payload");
      return null;
    }

    // Retrieve from Store
    const sessionData = await getSessionFromStore(sessionId);
    
    if (!sessionData) {
      log.warn("Session %s not found in store (expired/deleted)", sessionId);
      return null; // Force re-login
    }

    return sessionData;

  } catch (error) {
    log.error("Session retrieval failed:", error);
    return null;
  }
}

/**
 * Deletes session from store and cookie
 */
export async function deleteSession(): Promise<void> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (token) {
    try {
      const { payload } = await jwtVerify(token, getSecretKey());
      const sessionId = (payload as SessionTokenPayload).sessionId;
      if (sessionId) {
        log.debug("Deleting session %s", sessionId);
        await deleteSessionFromStore(sessionId);
      }
    } catch (e) {
      log.warn("Failed to delete session from store: invalid token");
    }
  }

  cookieStore.delete(SESSION_COOKIE_NAME);
}

export async function hasValidSession(): Promise<boolean> {
  return (await getSession()) !== null;
}

export async function refreshSession(): Promise<boolean> {
  const session = await getSession();
  if (!session) return false;

  // With server-side store, "refreshing" a session mostly means 
  // updating the expiration time in the store so it doesn't get cleaned up.
  // The cookie maxAge also needs updating.
  // Ideally we would grab the current sessionId, but getSession returns data, not ID.
  
  // For simplicity and robustness, we can just re-create the session 
  // which generates a new ID. This invalidates the old ID.
  // This is safe.
  
  await createSession({
    accessToken: session.accessToken,
    idToken: session.idToken,
    entitlementsToken: session.entitlementsToken,
    puuid: session.puuid,
    region: session.region,
    gameName: session.gameName,
    tagLine: session.tagLine,
    country: session.country,
    riotCookies: session.riotCookies,
  });

  return true;
}

export async function getSessionWithRefresh(): Promise<SessionData | null> {
  const session = await getSession();

  if (!session) {
    return null;
  }

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

  if (!session.riotCookies) {
    log.warn("No stored Riot cookies for token refresh");
    if (isTokenDefinitelyDead) {
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
        await deleteSession();
        return null;
      }
      return session;
    }

    const freshSession: SessionData = {
      accessToken: refreshResult.tokens.accessToken,
      idToken: refreshResult.tokens.idToken,
      entitlementsToken: refreshResult.tokens.entitlementsToken,
      puuid: refreshResult.tokens.puuid,
      region: refreshResult.tokens.region,
      gameName: refreshResult.tokens.gameName,
      tagLine: refreshResult.tokens.tagLine,
      country: refreshResult.tokens.country,
      riotCookies: refreshResult.riotCookies,
      createdAt: Date.now(),
    };

    await createSession(freshSession);
    log.info("Session refreshed successfully");

    return freshSession;
  } catch (error) {
    log.error("Token refresh error:", error);
    if (isTokenDefinitelyDead) {
      await deleteSession();
      return null;
    }
    return session;
  }
}
