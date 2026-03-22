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
// Mock: jose (async importOriginal pattern)
// ---------------------------------------------------------------------------

vi.mock("jose", async (importOriginal) => {
  const actual = await importOriginal<typeof import("jose")>();
  return {
    ...actual,
    jwtVerify: mockJwtVerify,
    SignJWT: vi.fn(() => ({
      setProtectedHeader: vi.fn().mockReturnThis(),
      setIssuedAt: vi.fn().mockReturnThis(),
      setExpirationTime: vi.fn().mockReturnThis(),
      sign: vi.fn().mockResolvedValue("mock-jwt-token"),
    })),
  };
});

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
// Tests will be added in subsequent tasks
// ---------------------------------------------------------------------------
