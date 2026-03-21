import { vi, describe, it, expect, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// ---------------------------------------------------------------------------
// Mocks — all declared before any imports (vi.mock is hoisted)
// ---------------------------------------------------------------------------

vi.mock("@/lib/rate-limiter", () => ({
  authRatelimit: {
    limit: vi.fn(),
  },
}));

vi.mock("@/lib/rate-limit-utils", () => ({
  getClientIP: vi.fn().mockReturnValue("127.0.0.1"),
  addRateLimitHeaders: vi.fn((response) => response),
  createRateLimitedResponse: vi.fn().mockImplementation(({ limit, remaining, reset }) => {
    return new (require("next/server").NextResponse)(
      JSON.stringify({ error: "Too many requests" }),
      { status: 429, headers: { "Content-Type": "application/json" } }
    );
  }),
}));

vi.mock("@/lib/session", () => ({
  getSession: vi.fn(),
}));

vi.mock("@/lib/accounts", () => ({
  getActiveAccount: vi.fn(),
  removeAccount: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/store-cache", () => ({
  clearCachedStore: vi.fn().mockResolvedValue(undefined),
}));

// ---------------------------------------------------------------------------
// Dynamic import of route AFTER mocks
// ---------------------------------------------------------------------------

const { POST } = await import("@/app/api/auth/logout/route");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeLogoutRequest(): NextRequest {
  return new NextRequest("http://localhost/api/auth/logout", {
    method: "POST",
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
});

describe("POST /api/auth/logout", () => {
  it("success: rate limit passes, session exists, clears store, removes account, returns 200 with rate limit headers", async () => {
    const { authRatelimit } = await import("@/lib/rate-limiter");
    vi.mocked(authRatelimit.limit).mockResolvedValue({
      success: true,
      limit: 10,
      remaining: 9,
      reset: Date.now() + 60000,
    });

    const { getSession } = await import("@/lib/session");
    vi.mocked(getSession).mockResolvedValue({ puuid: "test-puuid-1234" });

    const { getActiveAccount } = await import("@/lib/accounts");
    vi.mocked(getActiveAccount).mockResolvedValue({
      puuid: "test-puuid-1234",
      region: "na",
      gameName: "TestUser",
      tagLine: "NA1",
      addedAt: Date.now(),
    });

    const { clearCachedStore } = await import("@/lib/store-cache");
    const { removeAccount } = await import("@/lib/accounts");
    const { addRateLimitHeaders } = await import("@/lib/rate-limit-utils");

    const res = await POST(makeLogoutRequest());

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(clearCachedStore).toHaveBeenCalledWith("test-puuid-1234");
    expect(removeAccount).toHaveBeenCalledWith("test-puuid-1234");
    expect(addRateLimitHeaders).toHaveBeenCalled();
  });

  it("rate limited: authRatelimit.limit returns success:false, returns 429 via createRateLimitedResponse", async () => {
    const { authRatelimit } = await import("@/lib/rate-limiter");
    vi.mocked(authRatelimit.limit).mockResolvedValue({
      success: false,
      limit: 10,
      remaining: 0,
      reset: Date.now() + 60000,
    });

    const { createRateLimitedResponse } = await import("@/lib/rate-limit-utils");
    const { getSession } = await import("@/lib/session");
    const { clearCachedStore } = await import("@/lib/store-cache");

    const res = await POST(makeLogoutRequest());

    expect(res.status).toBe(429);
    const body = await res.json();
    expect(body.error).toBe("Too many requests");
    expect(getSession).not.toHaveBeenCalled();
    expect(clearCachedStore).not.toHaveBeenCalled();
  });

  it("no active session: getSession returns null, skips clearCachedStore, still returns 200", async () => {
    const { authRatelimit } = await import("@/lib/rate-limiter");
    vi.mocked(authRatelimit.limit).mockResolvedValue({
      success: true,
      limit: 10,
      remaining: 9,
      reset: Date.now() + 60000,
    });

    const { getSession } = await import("@/lib/session");
    vi.mocked(getSession).mockResolvedValue(null);

    const { clearCachedStore } = await import("@/lib/store-cache");

    const res = await POST(makeLogoutRequest());

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(clearCachedStore).not.toHaveBeenCalled();
  });

  it("no active account: getActiveAccount returns null, skips removeAccount, still returns 200", async () => {
    const { authRatelimit } = await import("@/lib/rate-limiter");
    vi.mocked(authRatelimit.limit).mockResolvedValue({
      success: true,
      limit: 10,
      remaining: 9,
      reset: Date.now() + 60000,
    });

    const { getSession } = await import("@/lib/session");
    vi.mocked(getSession).mockResolvedValue({ puuid: "test-puuid-1234" });

    const { getActiveAccount } = await import("@/lib/accounts");
    vi.mocked(getActiveAccount).mockResolvedValue(null);

    const { removeAccount } = await import("@/lib/accounts");

    const res = await POST(makeLogoutRequest());

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(removeAccount).not.toHaveBeenCalled();
  });

  it("response includes X-RateLimit-* headers via addRateLimitHeaders", async () => {
    const { authRatelimit } = await import("@/lib/rate-limiter");
    const resetTime = Date.now() + 60000;
    vi.mocked(authRatelimit.limit).mockResolvedValue({
      success: true,
      limit: 10,
      remaining: 9,
      reset: resetTime,
    });

    const { getSession } = await import("@/lib/session");
    vi.mocked(getSession).mockResolvedValue(null);

    const { addRateLimitHeaders } = await import("@/lib/rate-limit-utils");

    const res = await POST(makeLogoutRequest());

    expect(res.status).toBe(200);
    expect(addRateLimitHeaders).toHaveBeenCalled();
  });
});
