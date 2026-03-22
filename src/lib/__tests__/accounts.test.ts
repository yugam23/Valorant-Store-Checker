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
// Tests will be added in subsequent tasks
// ---------------------------------------------------------------------------
