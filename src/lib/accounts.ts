/**
 * Multi-Account Registry Module
 *
 * Manages multiple Riot account sessions using a cookie-based architecture:
 * - `valorant_accounts` cookie: JWT-signed registry of all stored accounts
 * - `valorant_session` cookie: Active account's session (existing)
 * - `valorant_session_{puuid_short}` cookies: Per-account session storage
 *
 * This allows users to store up to 5 accounts and switch between them
 * without re-authenticating each time.
 */

import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { env } from "./env";
import { createLogger } from "./logger";
import { randomUUID } from "crypto";
import { createSession, getSession, SessionData } from "./session";
import { 
  saveSessionToStore, 
  getSessionFromStore, 
  deleteSessionFromStore 
} from "./session-store";

const log = createLogger("accounts");

const ACCOUNTS_COOKIE_NAME = "valorant_accounts";
const SESSION_COOKIE_NAME = "valorant_session";
const ACCOUNTS_MAX_AGE = 60 * 60 * 24 * 30; // 30 days
const SESSION_MAX_AGE = 60 * 60 * 24 * 30; // 30 days
const MAX_ACCOUNTS = 5;

const getSecretKey = (): Uint8Array => {
  return new TextEncoder().encode(env.SESSION_SECRET);
};

export interface AccountEntry {
  puuid: string;
  region: string;
  gameName?: string;
  tagLine?: string;
  addedAt: number;
}

export interface AccountsData {
  accounts: AccountEntry[];
  activePuuid: string;
}

export interface SessionTokens {
  accessToken: string;
  entitlementsToken: string;
  puuid: string;
  region: string;
  gameName?: string;
  tagLine?: string;
  country?: string;
  riotCookies?: string;
}

function getShortPuuid(puuid: string): string {
  return puuid.substring(0, 8);
}

export async function getAccounts(): Promise<AccountsData | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(ACCOUNTS_COOKIE_NAME)?.value;

    if (!token) return null;

    const { payload } = await jwtVerify(token, getSecretKey());

    if (!payload.accounts || !Array.isArray(payload.accounts)) {
      return null;
    }

    return {
      accounts: payload.accounts as AccountEntry[],
      activePuuid: (payload.activePuuid as string) || "",
    };
  } catch (error) {
    log.error("Failed to get accounts registry:", error);
    return null;
  }
}

async function saveAccounts(data: AccountsData): Promise<void> {
  const token = await new SignJWT(data as unknown as Record<string, unknown>)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${ACCOUNTS_MAX_AGE}s`)
    .sign(getSecretKey());

  const cookieStore = await cookies();
  const isProduction = process.env.NODE_ENV === "production";
  cookieStore.set(ACCOUNTS_COOKIE_NAME, token, {
    httpOnly: true,
    secure: isProduction,
    sameSite: "lax",
    maxAge: ACCOUNTS_MAX_AGE,
    path: "/",
  });
}

/**
 * Save session tokens to a per-account cookie (SERVER-SIDE STORE VERSION)
 */
async function saveAccountSession(
  puuid: string,
  sessionData: SessionData
): Promise<void> {
  // 1. Generate Session ID
  const sessionId = randomUUID();

  // 2. Store Session Data Server-Side
  await saveSessionToStore(sessionId, sessionData, SESSION_MAX_AGE);

  // 3. Create Lightweight JWT Payload
  const token = await new SignJWT({ sessionId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE}s`)
    .sign(getSecretKey());

  const cookieStore = await cookies();
  const isProduction = process.env.NODE_ENV === "production";
  const cookieName = `${SESSION_COOKIE_NAME}_${getShortPuuid(puuid)}`;

  cookieStore.set(cookieName, token, {
    httpOnly: true,
    secure: isProduction,
    sameSite: "lax",
    maxAge: SESSION_MAX_AGE,
    path: "/",
  });
}

/**
 * Load session tokens from a per-account cookie
 */
async function loadAccountSession(puuid: string): Promise<SessionData | null> {
  try {
    const cookieStore = await cookies();
    const cookieName = `${SESSION_COOKIE_NAME}_${getShortPuuid(puuid)}`;
    const token = cookieStore.get(cookieName)?.value;

    if (!token) return null;

    // Verify JWT and extract sessionId
    const { payload } = await jwtVerify(token, getSecretKey());
    const sessionId = (payload as any).sessionId;

    if (!sessionId) return null;

    // Retrieve from store
    const sessionData = await getSessionFromStore(sessionId);
    return sessionData;
    
  } catch (error) {
    log.error(`Failed to load session for account ${getShortPuuid(puuid)}:`, error);
    return null;
  }
}

/**
 * Delete a per-account session cookie and store entry
 */
async function deleteAccountSession(puuid: string): Promise<void> {
  const cookieStore = await cookies();
  const cookieName = `${SESSION_COOKIE_NAME}_${getShortPuuid(puuid)}`;
  const token = cookieStore.get(cookieName)?.value;

  if (token) {
    try {
      const { payload } = await jwtVerify(token, getSecretKey());
      const sessionId = (payload as any).sessionId;
      if (sessionId) {
        log.debug(`Deleting per-account session ${sessionId} for ${getShortPuuid(puuid)}`);
        await deleteSessionFromStore(sessionId);
      }
    } catch (e) {
      log.warn(`Failed to delete account session for ${getShortPuuid(puuid)}: invalid token`);
    }
  }

  cookieStore.delete(cookieName);
}

/**
 * Add an account to the registry. Called after successful login.
 * If account already exists (same PUUID), update its tokens.
 * @param entry Account metadata
 * @param sessionTokens Session tokens for this account
 */

export async function addAccount(
  entry: AccountEntry,
  sessionTokens: SessionTokens
): Promise<void> {
  let registry = await getAccounts();

  // Initialize registry if it doesn't exist
  if (!registry) {
    registry = {
      accounts: [],
      activePuuid: entry.puuid,
    };
  }

  // Check if account already exists
  const existingIndex = registry.accounts.findIndex(
    (acc) => acc.puuid === entry.puuid
  );

  if (existingIndex >= 0) {
    // Update existing account metadata
    registry.accounts[existingIndex] = {
      ...registry.accounts[existingIndex],
      ...entry,
      addedAt: registry.accounts[existingIndex].addedAt,
    };
    log.info(`Updated existing account ${getShortPuuid(entry.puuid)}`);
  } else {
    // Add new account
    if (registry.accounts.length >= MAX_ACCOUNTS) {
      // Remove oldest account
      const removed = registry.accounts.shift();
      if (removed) {
        await deleteAccountSession(removed.puuid);
        log.info(
          `Removed oldest account ${getShortPuuid(removed.puuid)} (max accounts reached)`
        );
      }
    }

    registry.accounts.push(entry);
    log.info(`Added new account ${getShortPuuid(entry.puuid)}`);
  }

  // Set this as the active account
  registry.activePuuid = entry.puuid;

  // Save the registry
  await saveAccounts(registry);

  // Construct SessionData
  const sessionData: SessionData = {
    accessToken: sessionTokens.accessToken,
    entitlementsToken: sessionTokens.entitlementsToken,
    puuid: sessionTokens.puuid,
    region: sessionTokens.region,
    gameName: sessionTokens.gameName ?? entry.gameName,
    tagLine: sessionTokens.tagLine ?? entry.tagLine,
    country: sessionTokens.country,
    riotCookies: sessionTokens.riotCookies,
    createdAt: Date.now(),
  };

  // Save to per-account storage
  await saveAccountSession(entry.puuid, sessionData);

  // Set as the main active session (using createSession from session.ts)
  await createSession(sessionData);

  log.info(
    `Account ${getShortPuuid(entry.puuid)} is now active (total: ${registry.accounts.length})`
  );
}

export async function switchAccount(targetPuuid: string): Promise<boolean> {
  const registry = await getAccounts();

  if (!registry) {
    log.error("No account registry found");
    return false;
  }

  // Check if target account exists
  const targetAccount = registry.accounts.find(
    (acc) => acc.puuid === targetPuuid
  );

  if (!targetAccount) {
    log.error(`Account ${getShortPuuid(targetPuuid)} not found in registry`);
    return false;
  }

  // Save current active session to its per-account cookie (if exists)
  const currentSession = await getSession();
  if (currentSession && currentSession.puuid !== targetPuuid) {
    await saveAccountSession(currentSession.puuid, currentSession);
    log.info(
      `Saved current session for ${getShortPuuid(currentSession.puuid)}`
    );
  }

  // Load target account's session
  const targetSession = await loadAccountSession(targetPuuid);

  if (!targetSession) {
    log.error(
      `Session not found for account ${getShortPuuid(targetPuuid)}`
    );
    return false;
  }

  // Set as active session
  await createSession(targetSession);

  // Update registry
  registry.activePuuid = targetPuuid;
  await saveAccounts(registry);

  log.info(`Switched to account ${getShortPuuid(targetPuuid)}`);
  return true;
}

export async function removeAccount(puuid: string): Promise<void> {
  const registry = await getAccounts();

  if (!registry) {
    log.warn("No account registry found");
    return;
  }

  // Find account index
  const accountIndex = registry.accounts.findIndex(
    (acc) => acc.puuid === puuid
  );

  if (accountIndex < 0) {
    log.warn(`Account ${getShortPuuid(puuid)} not found in registry`);
    return;
  }

  // Remove account from registry
  registry.accounts.splice(accountIndex, 1);

  // Delete per-account session cookie
  await deleteAccountSession(puuid);

  log.info(`Removed account ${getShortPuuid(puuid)}`);

  // If this was the active account, switch to next available or clear
  if (registry.activePuuid === puuid) {
    if (registry.accounts.length > 0) {
      // Switch to the first remaining account
      const nextAccount = registry.accounts[0];
      const nextSession = await loadAccountSession(nextAccount.puuid);

      if (nextSession) {
        await createSession(nextSession);
        registry.activePuuid = nextAccount.puuid;
        log.info(
          `Switched to next account ${getShortPuuid(nextAccount.puuid)}`
        );
      } else {
        // Session not found, clear everything
        const cookieStore = await cookies();
        cookieStore.delete(SESSION_COOKIE_NAME);
        registry.activePuuid = "";
        log.warn("Next account session not found, cleared active session");
      }
    } else {
      // No accounts left, clear active session and registry
      const cookieStore = await cookies();
      cookieStore.delete(SESSION_COOKIE_NAME);
      cookieStore.delete(ACCOUNTS_COOKIE_NAME);
      log.info("No accounts remaining, cleared all sessions");
      return;
    }
  }

  // Save updated registry
  await saveAccounts(registry);
}

/**
 * Get the currently active account entry
 * @returns Active account entry if exists, null otherwise
 */
export async function getActiveAccount(): Promise<AccountEntry | null> {
  const registry = await getAccounts();

  if (!registry || !registry.activePuuid) {
    return null;
  }

  const activeAccount = registry.accounts.find(
    (acc) => acc.puuid === registry.activePuuid
  );

  return activeAccount || null;
}
