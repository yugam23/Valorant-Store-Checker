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
import { cookies } from "next/headers";

const SESSION_COOKIE_NAME = "valorant_session";
const SESSION_MAX_AGE = 60 * 60 * 24 * 7; // 7 days in seconds

// Secret key for JWT encryption (should be in environment variable)
const getSecretKey = (): Uint8Array => {
  const secret = process.env.SESSION_SECRET || "default-secret-change-in-production";
  return new TextEncoder().encode(secret);
};

export interface SessionData {
  accessToken: string;
  idToken: string;
  entitlementsToken: string;
  puuid: string;
  region: string;
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
  idToken: string;
  entitlementsToken: string;
  puuid: string;
  region: string;
  riotCookies?: string;
}): Promise<void> {
  const sessionData: SessionData = {
    ...tokens,
    createdAt: Date.now(),
  };

  // Create encrypted JWT
  const token = await new SignJWT(sessionData)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE}s`)
    .sign(getSecretKey());

  // Set HTTP-only cookie
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
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
      idToken: payload.idToken as string,
      entitlementsToken: payload.entitlementsToken as string,
      puuid: payload.puuid as string,
      region: payload.region as string,
      riotCookies: payload.riotCookies as string | undefined,
      createdAt: payload.createdAt as number,
    };
  } catch (error) {
    // Token verification failed (expired, invalid, tampered)
    console.error("Session verification failed:", error);
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
    riotCookies: session.riotCookies,
  });

  return true;
}
