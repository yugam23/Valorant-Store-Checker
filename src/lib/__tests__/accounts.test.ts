import { vi, describe, it, expect, beforeEach } from "vitest";
import { createClient, type Client } from "@libsql/client";
import type { AccountEntry, SessionTokens } from "@/lib/accounts";

// ---------------------------------------------------------------------------
// Module-level mock state - declared outside describe blocks
// ---------------------------------------------------------------------------

let testClient: Client;

const mockJwtVerify = vi.fn();
const mockCookiesGet = vi.fn();
const mockCookiesSet = vi.fn();
const mockCookiesDelete = vi.fn();
const mockGetSession = vi.fn();
const mockSaveSession = vi.fn();
const mockDeleteSession = vi.fn();
const mockCreateSession = vi.fn();
const mockGetSessionFromStore = vi.fn();
const mockSaveSessionToStore = vi.fn();
const mockDeleteSessionFromStore = vi.fn();

// ---------------------------------------------------------------------------
// Mock: @/lib/session-db (in-memory SQLite)
// ---------------------------------------------------------------------------

vi.mock("@/lib/session-db", () => ({
  initSessionDb: vi.fn(async () => testClient),
}));

// ---------------------------------------------------------------------------
// Mock: @/lib/session-store
// ---------------------------------------------------------------------------

vi.mock("@/lib/session-store", () => ({
  getSessionFromStore: (...args: unknown[]) => mockGetSessionFromStore(...args),
  saveSessionToStore: (...args: unknown[]) => mockSaveSessionToStore(...args),
  deleteSessionFromStore: (...args: unknown[]) => mockDeleteSessionFromStore(...args),
  cleanupExpiredSessions: vi.fn(),
  refreshSessionExpiration: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Mock: jose
// ---------------------------------------------------------------------------

vi.mock("jose", () => ({
  jwtVerify: mockJwtVerify,
  SignJWT: vi.fn(function (this: Record<string, unknown>) {
    return {
      setProtectedHeader: vi.fn().mockReturnThis(),
      setIssuedAt: vi.fn().mockReturnThis(),
      setExpirationTime: vi.fn().mockReturnThis(),
      sign: vi.fn().mockResolvedValue("mock-jwt-token"),
    };
  }),
}));

// ---------------------------------------------------------------------------
// Mock: next/headers
// ---------------------------------------------------------------------------

vi.mock("next/headers", () => ({
  cookies: vi.fn(() => ({
    get: mockCookiesGet,
    set: mockCookiesSet,
    delete: mockCookiesDelete,
  })),
}));

// ---------------------------------------------------------------------------
// Mock: @/lib/session
// ---------------------------------------------------------------------------

vi.mock("@/lib/session", () => ({
  createSession: (...args: unknown[]) => mockCreateSession(...args),
  getSession: (...args: unknown[]) => mockGetSession(...args),
}));

// ---------------------------------------------------------------------------
// Import module under test AFTER all mocks are declared
// ---------------------------------------------------------------------------

const { getAccounts, getActiveAccount, addAccount, switchAccount, removeAccount } = await import("@/lib/accounts");

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeAccountEntry(overrides: Partial<AccountEntry> = {}): AccountEntry {
  const id = Math.random().toString(36).slice(2, 10);
  return {
    puuid: `test-puuid-${id}`,
    region: "na",
    gameName: "TestPlayer",
    tagLine: "NA1",
    addedAt: Date.now(),
    ...overrides,
  };
}

function makeSessionTokens(overrides: Partial<SessionTokens> = {}): SessionTokens {
  return {
    accessToken: "test-access-token",
    entitlementsToken: "test-entitlements-token",
    puuid: "test-puuid",
    region: "na",
    gameName: "TestPlayer",
    tagLine: "NA1",
    country: "US",
    riotCookies: "ssid=test-ssid; clid=test-clid",
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// beforeEach: fresh in-memory SQLite + mock reset
// ---------------------------------------------------------------------------

beforeEach(async () => {
  // Create fresh in-memory SQLite per test
  testClient = createClient({ url: ":memory:" });
  await testClient.execute(
    "CREATE TABLE IF NOT EXISTS sessions (id TEXT PRIMARY KEY, data TEXT NOT NULL, expires_at INTEGER NOT NULL)",
  );

  // CRITICAL: Use mockReset() NOT mockClear() to reset implementation
  mockJwtVerify.mockReset();
  mockCookiesGet.mockReset();
  mockCookiesSet.mockReset();
  mockCookiesDelete.mockReset();
  mockGetSession.mockReset();
  mockSaveSession.mockReset();
  mockDeleteSession.mockReset();
  mockCreateSession.mockReset();
  mockGetSessionFromStore.mockReset();
  mockSaveSessionToStore.mockReset();
  mockDeleteSessionFromStore.mockReset();

  // Default resolved values
  mockJwtVerify.mockResolvedValue({ payload: { accounts: [], activePuuid: "" } });
  mockCookiesGet.mockReturnValue(undefined);
  mockGetSession.mockResolvedValue(null);
  mockGetSessionFromStore.mockResolvedValue(null);
  mockSaveSessionToStore.mockResolvedValue(undefined);
  mockCreateSession.mockResolvedValue(undefined);
});

// ---------------------------------------------------------------------------
// Tests: getAccounts
// ---------------------------------------------------------------------------

describe("getAccounts", () => {
  it("returns AccountsData when valid token exists", async () => {
    const accountsPayload = {
      accounts: [
        { puuid: "test-puuid-1", region: "na", gameName: "Player1", tagLine: "NA1", addedAt: Date.now() },
        { puuid: "test-puuid-2", region: "eu", gameName: "Player2", tagLine: "EU1", addedAt: Date.now() },
      ],
      activePuuid: "test-puuid-1",
    };
    mockJwtVerify.mockResolvedValue({ payload: accountsPayload });
    mockCookiesGet.mockReturnValue({ value: "valid-accounts-token" });

    const result = await getAccounts();

    expect(result).not.toBeNull();
    expect(result!.accounts).toHaveLength(2);
    expect(result!.activePuuid).toBe("test-puuid-1");
  });

  it("returns null when no accounts cookie exists", async () => {
    mockCookiesGet.mockReturnValue(undefined);

    const result = await getAccounts();

    expect(result).toBeNull();
  });

  it("returns null when token is invalid/malformed", async () => {
    mockJwtVerify.mockRejectedValue(new Error("jwt error"));
    mockCookiesGet.mockReturnValue({ value: "malformed-token" });

    const result = await getAccounts();

    expect(result).toBeNull();
  });

  it("returns null when payload missing accounts array", async () => {
    mockJwtVerify.mockResolvedValue({ payload: { activePuuid: "test-puuid" } });
    mockCookiesGet.mockReturnValue({ value: "valid-token" });

    const result = await getAccounts();

    expect(result).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Tests: getActiveAccount
// ---------------------------------------------------------------------------

describe("getActiveAccount", () => {
  it("returns AccountEntry when active account exists", async () => {
    const entry = makeAccountEntry({ puuid: "active-puuid-123" });
    mockJwtVerify.mockResolvedValue({
      payload: {
        accounts: [entry],
        activePuuid: "active-puuid-123",
      },
    });
    mockCookiesGet.mockReturnValue({ value: "valid-token" });

    const result = await getActiveAccount();

    expect(result).not.toBeNull();
    expect(result!.puuid).toBe("active-puuid-123");
  });

  it("returns null when registry is null", async () => {
    mockCookiesGet.mockReturnValue(undefined);

    const result = await getActiveAccount();

    expect(result).toBeNull();
  });

  it("returns null when activePuuid is empty string", async () => {
    mockJwtVerify.mockResolvedValue({
      payload: {
        accounts: [{ puuid: "some-puuid", region: "na", addedAt: Date.now() }],
        activePuuid: "",
      },
    });
    mockCookiesGet.mockReturnValue({ value: "valid-token" });

    const result = await getActiveAccount();

    expect(result).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Tests: addAccount
// ---------------------------------------------------------------------------

describe("addAccount", () => {
  it("adds new account and sets as active", async () => {
    const entry = makeAccountEntry({ puuid: "new-puuid-1" });
    const tokens = makeSessionTokens({ puuid: "new-puuid-1" });

    // Mock getAccounts returning null (no existing registry)
    mockCookiesGet.mockReturnValue(undefined);
    mockJwtVerify.mockRejectedValue(new Error("no token"));

    await addAccount(entry, tokens);

    // Should have called createSession
    expect(mockCreateSession).toHaveBeenCalled();
    // Should have saved account session
    expect(mockSaveSessionToStore).toHaveBeenCalled();
  });

  it("updates existing account when puuid matches", async () => {
    const existingEntry = makeAccountEntry({ puuid: "same-puuid", gameName: "OldName" });
    const updatedEntry = makeAccountEntry({ puuid: "same-puuid", gameName: "NewName" });
    const tokens = makeSessionTokens({ puuid: "same-puuid" });

    let callCount = 0;
    // First call returns existing registry, subsequent calls also return it
    mockJwtVerify.mockImplementation(async () => {
      callCount++;
      return {
        payload: {
          accounts: [existingEntry],
          activePuuid: "same-puuid",
        },
      };
    });
    mockCookiesGet.mockReturnValue({ value: "existing-token" });

    await addAccount(updatedEntry, tokens);

    // createSession should be called to set updated session
    expect(mockCreateSession).toHaveBeenCalled();
  });

  it("removes oldest account when MAX_ACCOUNTS (5) exceeded", async () => {
    // Build a registry with 5 existing accounts
    const existingAccounts: AccountEntry[] = [];
    for (let i = 0; i < 5; i++) {
      existingAccounts.push(makeAccountEntry({ puuid: `existing-${i}`, gameName: `Player${i}` }));
    }

    let callCount = 0;
    mockJwtVerify.mockImplementation(async () => {
      callCount++;
      if (callCount === 1) {
        // First call: getAccounts() - return full registry
        return {
          payload: {
            accounts: [...existingAccounts],
            activePuuid: "existing-0",
          },
        };
      }
      // Subsequent calls: deleteAccountSession wants sessionId
      return {
        payload: { sessionId: "session-for-deleted-account" },
      };
    });
    mockCookiesGet.mockReturnValue({ value: "token" });

    // Add 6th account
    const newEntry = makeAccountEntry({ puuid: "new-puuid-6" });
    const newTokens = makeSessionTokens({ puuid: "new-puuid-6" });
    await addAccount(newEntry, newTokens);

    // Should have called deleteSessionFromStore when oldest was removed
    expect(mockDeleteSessionFromStore).toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Tests: switchAccount
// ---------------------------------------------------------------------------

describe("switchAccount", () => {
  it("switches to existing account successfully", async () => {
    const entry1 = makeAccountEntry({ puuid: "acc-1", gameName: "Player1" });
    const entry2 = makeAccountEntry({ puuid: "acc-2", gameName: "Player2" });

    let callCount = 0;
    mockJwtVerify.mockImplementation(async () => {
      callCount++;
      if (callCount === 1) {
        // First call: getAccounts() - return registry
        return {
          payload: {
            accounts: [entry1, entry2],
            activePuuid: "acc-1",
          },
        };
      }
      // Second call: loadAccountSession() - return sessionId
      return {
        payload: { sessionId: "session-id-for-acc-2" },
      };
    });
    mockCookiesGet.mockReturnValue({ value: "accounts-token" });

    // Current session is acc-1
    mockGetSession.mockResolvedValue({
      accessToken: "token-1",
      entitlementsToken: "ent-token-1",
      puuid: "acc-1",
      region: "na",
      createdAt: Date.now(),
    });

    // Target account's session (acc-2) is available
    mockGetSessionFromStore.mockResolvedValue({
      accessToken: "token-2",
      entitlementsToken: "ent-token-2",
      puuid: "acc-2",
      region: "na",
      createdAt: Date.now(),
    });

    const result = await switchAccount("acc-2");

    expect(result).toBe(true);
    expect(mockCreateSession).toHaveBeenCalled();
  });

  it("returns false when account not found", async () => {
    mockJwtVerify.mockResolvedValue({
      payload: {
        accounts: [{ puuid: "existing-puuid", region: "na", addedAt: Date.now() }],
        activePuuid: "existing-puuid",
      },
    });
    mockCookiesGet.mockReturnValue({ value: "accounts-token" });

    const result = await switchAccount("non-existent-puuid");

    expect(result).toBe(false);
  });

  it("returns false when registry is null", async () => {
    mockCookiesGet.mockReturnValue(undefined);

    const result = await switchAccount("any-puuid");

    expect(result).toBe(false);
  });

  it("returns false when target session not found in store", async () => {
    const entry1 = makeAccountEntry({ puuid: "acc-1" });
    const entry2 = makeAccountEntry({ puuid: "acc-2" });

    mockJwtVerify.mockResolvedValue({
      payload: {
        accounts: [entry1, entry2],
        activePuuid: "acc-1",
      },
    });
    mockCookiesGet.mockReturnValue({ value: "accounts-token" });

    mockGetSession.mockResolvedValue({
      accessToken: "token-1",
      entitlementsToken: "ent-token-1",
      puuid: "acc-1",
      region: "na",
      createdAt: Date.now(),
    });

    // Target session doesn't exist in store
    mockGetSessionFromStore.mockResolvedValue(null);

    const result = await switchAccount("acc-2");

    expect(result).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Tests: removeAccount
// ---------------------------------------------------------------------------

describe("removeAccount", () => {
  it("removes account from registry", async () => {
    const entry1 = makeAccountEntry({ puuid: "remove-1" });
    const entry2 = makeAccountEntry({ puuid: "remove-2" });

    // jwtVerify is called:
    // 1. getAccounts() - returns registry with both accounts
    // 2. deleteAccountSession() - returns sessionId
    // 3. getAccounts() again after modification
    let callCount = 0;
    mockJwtVerify.mockImplementation(async () => {
      callCount++;
      if (callCount === 1 || callCount === 3) {
        // getAccounts calls
        return {
          payload: {
            accounts: callCount === 1 ? [entry1, entry2] : [entry2],
            activePuuid: "remove-2",
          },
        };
      }
      // deleteAccountSession verification - returns sessionId
      return { payload: { sessionId: "session-for-remove-1" } };
    });
    mockCookiesGet.mockReturnValue({ value: "accounts-token" });

    await removeAccount("remove-1");

    // Account should have been removed (deleteAccountSession called)
    expect(mockDeleteSessionFromStore).toHaveBeenCalled();
  });

  it("switches to first remaining account when active is removed", async () => {
    const entry1 = makeAccountEntry({ puuid: "active-1" });
    const entry2 = makeAccountEntry({ puuid: "active-2" });

    // jwtVerify is called:
    // 1. getAccounts() - returns registry with both accounts
    // 2. deleteAccountSession() - returns sessionId
    // 3. loadAccountSession() for next account - returns sessionId
    let callCount = 0;
    mockJwtVerify.mockImplementation(async () => {
      callCount++;
      if (callCount === 1) {
        return {
          payload: {
            accounts: [entry1, entry2],
            activePuuid: "active-1",
          },
        };
      }
      // deleteAccountSession verification and loadAccountSession both want sessionId
      return { payload: { sessionId: "session-for-account" } };
    });
    mockCookiesGet.mockReturnValue({ value: "accounts-token" });

    // Mock loadAccountSession to return entry2's session
    mockGetSessionFromStore.mockResolvedValue({
      accessToken: "token-2",
      entitlementsToken: "ent-token-2",
      puuid: "active-2",
      region: "na",
      createdAt: Date.now(),
    });

    await removeAccount("active-1");

    // Should switch to remaining account
    expect(mockCreateSession).toHaveBeenCalled();
  });

  it("clears all cookies when last account removed", async () => {
    const entry = makeAccountEntry({ puuid: "last-account" });

    mockJwtVerify.mockResolvedValue({
      payload: {
        accounts: [entry],
        activePuuid: "last-account",
      },
    });
    mockCookiesGet.mockReturnValue({ value: "accounts-token" });

    await removeAccount("last-account");

    // Should delete cookies
    expect(mockCookiesDelete).toHaveBeenCalled();
  });

  it("does nothing when account not found in registry", async () => {
    mockJwtVerify.mockResolvedValue({
      payload: {
        accounts: [{ puuid: "existing", region: "na", addedAt: Date.now() }],
        activePuuid: "existing",
      },
    });
    mockCookiesGet.mockReturnValue({ value: "accounts-token" });

    // Should not throw
    await expect(removeAccount("non-existent")).resolves.not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// Tests will be added in subsequent tasks
// ---------------------------------------------------------------------------
