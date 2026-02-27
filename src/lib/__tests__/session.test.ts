import { vi, describe, it, expect, beforeEach } from "vitest";
import type { SessionData } from "@/lib/session-types";

// ---------------------------------------------------------------------------
// Mocks — all declared before any imports (vi.mock is hoisted)
// ---------------------------------------------------------------------------

// Mock session-store for save/get/delete control
const mockGetSession = vi.fn();
const mockSaveSession = vi.fn();
const mockDeleteSession = vi.fn();

vi.mock("@/lib/session-store", () => ({
  getSessionFromStore: (...args: unknown[]) => mockGetSession(...args),
  saveSessionToStore: (...args: unknown[]) => mockSaveSession(...args),
  deleteSessionFromStore: (...args: unknown[]) => mockDeleteSession(...args),
  cleanupExpiredSessions: vi.fn(),
}));

// Mock riot-reauth for refresh control
const mockRefresh = vi.fn();
vi.mock("@/lib/riot-reauth", () => ({
  refreshTokensWithCookies: (...args: unknown[]) => mockRefresh(...args),
}));

// Mock jose for JWT verification bypass
vi.mock("jose", () => ({
  jwtVerify: vi.fn(async () => ({
    payload: { sessionId: "test-session-id" },
  })),
  SignJWT: vi.fn(() => ({
    setProtectedHeader: vi.fn().mockReturnThis(),
    setIssuedAt: vi.fn().mockReturnThis(),
    setExpirationTime: vi.fn().mockReturnThis(),
    sign: vi.fn(async () => "mock-jwt-token"),
  })),
}));

// Mock next/headers cookies to return our test JWT
// This overrides the global mock in vitest.setup.ts for this test file
vi.mock("next/headers", () => ({
  cookies: vi.fn(() => ({
    get: vi.fn((name: string) => {
      if (name === "valorant_session") return { value: "mock-jwt-token" };
      return undefined;
    }),
    set: vi.fn(),
    delete: vi.fn(),
  })),
}));

// ---------------------------------------------------------------------------
// Import module under test AFTER mocks are declared
// ---------------------------------------------------------------------------

const { getSessionWithRefresh } = await import("@/lib/session");

// ---------------------------------------------------------------------------
// Session fixture factory
// ---------------------------------------------------------------------------

function makeSession(overrides: Partial<SessionData> = {}): SessionData {
  return {
    accessToken: "test-access-token",
    entitlementsToken: "test-entitlements-token",
    puuid: "test-puuid",
    region: "na",
    createdAt: Date.now(),
    riotCookies: "ssid=test-ssid; clid=test-clid",
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
});

describe("getSessionWithRefresh — branching logic", () => {
  it("fresh token (10 min old): returns session WITHOUT calling refresh", async () => {
    const session = makeSession({
      createdAt: Date.now() - 10 * 60 * 1000, // 10 minutes ago
    });
    mockGetSession.mockResolvedValue(session);

    const result = await getSessionWithRefresh();

    expect(mockRefresh).not.toHaveBeenCalled();
    expect(result).not.toBeNull();
    expect(result!.accessToken).toBe("test-access-token");
  });

  it("token at 56 minutes (refresh succeeds): returns fresh session and saves to store", async () => {
    const session = makeSession({
      createdAt: Date.now() - 56 * 60 * 1000, // 56 minutes ago
    });
    mockGetSession.mockResolvedValue(session);
    mockRefresh.mockResolvedValue({
      success: true,
      tokens: {
        accessToken: "fresh-token",
        idToken: "fresh-id",
        entitlementsToken: "fresh-ent",
        puuid: "test-puuid",
        region: "na",
      },
      riotCookies: "ssid=refreshed",
    });

    const result = await getSessionWithRefresh();

    expect(mockRefresh).toHaveBeenCalledOnce();
    expect(mockSaveSession).toHaveBeenCalledOnce();
    expect(result).not.toBeNull();
    expect(result!.accessToken).toBe("fresh-token");
  });

  it("token at 56 minutes (refresh fails): returns original session (graceful degradation)", async () => {
    const session = makeSession({
      createdAt: Date.now() - 56 * 60 * 1000,
    });
    mockGetSession.mockResolvedValue(session);
    mockRefresh.mockResolvedValue({
      success: false,
      error: "SSID expired",
    });

    const result = await getSessionWithRefresh();

    // Graceful degradation: stale token returned, session NOT deleted
    expect(result).not.toBeNull();
    expect(result!.accessToken).toBe("test-access-token");
    expect(mockDeleteSession).not.toHaveBeenCalled();
  });

  it("token at 66 minutes (refresh fails): session deleted, returns null", async () => {
    const session = makeSession({
      createdAt: Date.now() - 66 * 60 * 1000, // 66 minutes ago — past hard expiry
    });
    mockGetSession.mockResolvedValue(session);
    mockRefresh.mockResolvedValue({
      success: false,
      error: "SSID expired",
    });

    const result = await getSessionWithRefresh();

    expect(mockDeleteSession).toHaveBeenCalledWith("test-session-id");
    expect(result).toBeNull();
  });

  it("token at 66 minutes (no riotCookies): refresh NOT called, session deleted, returns null", async () => {
    const session = makeSession({
      createdAt: Date.now() - 66 * 60 * 1000,
      riotCookies: undefined,
    });
    mockGetSession.mockResolvedValue(session);

    const result = await getSessionWithRefresh();

    expect(mockRefresh).not.toHaveBeenCalled();
    expect(mockDeleteSession).toHaveBeenCalledWith("test-session-id");
    expect(result).toBeNull();
  });
});
