import { vi, describe, it, expect, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";

// ---------------------------------------------------------------------------
// Mocks — all declared before any imports (vi.mock is hoisted)
// ---------------------------------------------------------------------------

vi.mock("@/lib/riot-auth", () => ({
  authenticateRiotAccount: vi.fn(),
  submitMfa: vi.fn(),
  completeAuthWithUrl: vi.fn(),
}));

vi.mock("@/lib/riot-reauth", () => ({
  refreshTokensWithCookies: vi.fn(),
}));

vi.mock("@/lib/browser-auth", () => ({
  authenticateWithBrowser: vi.fn(),
  launchBasicBrowser: vi.fn(),
}));

vi.mock("@/lib/session", () => ({
  createSession: vi.fn().mockResolvedValue(undefined),
  getSession: vi.fn(),
  getSessionWithRefresh: vi.fn(),
}));

vi.mock("@/lib/accounts", () => ({
  addAccount: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/rate-limiter", () => ({
  authRatelimit: {
    limit: vi.fn().mockResolvedValue({
      success: true,
      limit: 10,
      remaining: 9,
      reset: Date.now() + 60000,
      pending: Promise.resolve(0),
    }),
  },
  rateLimit: vi.fn().mockResolvedValue({
    success: true,
    limit: 10,
    remaining: 9,
    reset: Date.now() + 60000,
    pending: Promise.resolve(0),
  }),
}));

vi.mock("@/lib/rate-limit-utils", () => ({
  getClientIP: vi.fn().mockReturnValue("127.0.0.1"),
  addRateLimitHeaders: vi.fn((response) => response),
  createRateLimitedResponse: vi.fn().mockImplementation(() => {
    return new NextResponse(
      JSON.stringify({ error: "Too many requests" }),
      { status: 429, headers: { "Content-Type": "application/json" } }
    );
  }),
}));

// ---------------------------------------------------------------------------
// Dynamic import of route AFTER mocks
// ---------------------------------------------------------------------------

const { POST } = await import("@/app/api/auth/route");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeAuthRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/auth", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

const mockTokens = {
  accessToken: "access-tok",
  idToken: "id-tok",
  entitlementsToken: "ent-tok",
  puuid: "test-puuid-1234",
  region: "na",
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
});

describe("POST /api/auth — credentials branch (type: auth)", () => {
  it("success: authenticateRiotAccount returns tokens → 200 with puuid", async () => {
    const { authenticateRiotAccount } = await import("@/lib/riot-auth");
    vi.mocked(authenticateRiotAccount).mockResolvedValue({
      success: true,
      tokens: mockTokens,
      riotCookies: "ssid=x",
      namedCookies: { raw: "ssid=x" },
    });

    const res = await POST(
      makeAuthRequest({ type: "auth", username: "user", password: "pass" }),
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.puuid).toBe("test-puuid-1234");
  });

  it("MFA required: authenticateRiotAccount returns multifactor → 200 with requiresMfa", async () => {
    const { authenticateRiotAccount } = await import("@/lib/riot-auth");
    vi.mocked(authenticateRiotAccount).mockResolvedValue({
      success: false,
      type: "multifactor",
      cookie: "asid=x",
      multifactor: { email: "u@example.com", method: "email" },
    });

    const res = await POST(
      makeAuthRequest({ type: "auth", username: "user", password: "pass" }),
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.requiresMfa).toBe(true);
  });

  it("failure: standard auth fails + browser auth fails → 401", async () => {
    const { authenticateRiotAccount } = await import("@/lib/riot-auth");
    const { authenticateWithBrowser } = await import("@/lib/browser-auth");
    vi.mocked(authenticateRiotAccount).mockResolvedValue({
      success: false,
      error: "auth_failure",
    });
    vi.mocked(authenticateWithBrowser).mockResolvedValue({
      success: false,
      error: "browser_failed",
    });

    const res = await POST(
      makeAuthRequest({ type: "auth", username: "user", password: "pass" }),
    );

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBeTruthy();
  });
});

describe("POST /api/auth — MFA branch (type: multifactor)", () => {
  it("success: submitMfa returns tokens → 200 with puuid", async () => {
    const { submitMfa } = await import("@/lib/riot-auth");
    vi.mocked(submitMfa).mockResolvedValue({
      success: true,
      tokens: mockTokens,
      riotCookies: "ssid=x",
      namedCookies: { raw: "ssid=x" },
    });

    const res = await POST(
      makeAuthRequest({ type: "multifactor", code: "123456", cookie: "asid=x" }),
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.puuid).toBe("test-puuid-1234");
  });
});

describe("POST /api/auth — URL branch (type: url)", () => {
  it("success: completeAuthWithUrl returns tokens → 200 with puuid", async () => {
    const { completeAuthWithUrl } = await import("@/lib/riot-auth");
    vi.mocked(completeAuthWithUrl).mockResolvedValue({
      success: true,
      tokens: { ...mockTokens, riotCookies: "ssid=x" },
    });

    const res = await POST(
      makeAuthRequest({
        type: "url",
        url: "https://playvalorant.com/opt_in#access_token=abc",
      }),
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.puuid).toBe("test-puuid-1234");
  });
});

describe("POST /api/auth — cookie branch (type: cookie)", () => {
  it("success: refreshTokensWithCookies returns tokens → 200 with puuid", async () => {
    const { refreshTokensWithCookies } = await import("@/lib/riot-reauth");
    vi.mocked(refreshTokensWithCookies).mockResolvedValue({
      success: true,
      tokens: mockTokens,
      riotCookies: "ssid=new",
      namedCookies: { raw: "ssid=new" },
    });

    const res = await POST(
      makeAuthRequest({ type: "cookie", cookie: "ssid=old" }),
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.puuid).toBe("test-puuid-1234");
  });
});

describe("POST /api/auth — browser branch (type: launch_browser)", () => {
  it("success: launchBasicBrowser returns success → 200", async () => {
    const { launchBasicBrowser } = await import("@/lib/browser-auth");
    vi.mocked(launchBasicBrowser).mockResolvedValue({
      success: true,
    });

    const res = await POST(makeAuthRequest({ type: "launch_browser" }));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
  });
});

describe("POST /api/auth — invalid body", () => {
  it("unknown type returns 400 (Zod discriminatedUnion validation fails)", async () => {
    const res = await POST(makeAuthRequest({ type: "invalid" }));
    expect(res.status).toBe(400);
  });
});

describe("POST /api/auth — rate limiting", () => {
  it("returns 429 when rate limit is exceeded", async () => {
    const { rateLimit } = await import("@/lib/rate-limiter");
    vi.mocked(rateLimit).mockResolvedValueOnce({
      success: false,
      limit: 10,
      remaining: 0,
      reset: Date.now() + 60000,
      pending: Promise.resolve(0),
    });

    const res = await POST(
      makeAuthRequest({ type: "auth", username: "user", password: "pass" }),
    );

    expect(res.status).toBe(429);
    const body = await res.json();
    expect(body.error).toBe("Too many requests");
  });

  it("successful response includes rate limit headers via addRateLimitHeaders", async () => {
    // The mock for addRateLimitHeaders returns the response unchanged (identity).
    // This test verifies the handler calls addRateLimitHeaders on success.
    const { addRateLimitHeaders } = await import("@/lib/rate-limit-utils");
    vi.mocked(addRateLimitHeaders).mockClear();

    const { authenticateRiotAccount } = await import("@/lib/riot-auth");
    vi.mocked(authenticateRiotAccount).mockResolvedValue({
      success: true,
      tokens: mockTokens,
      riotCookies: "ssid=x",
      namedCookies: { raw: "ssid=x" },
    });

    const res = await POST(
      makeAuthRequest({ type: "auth", username: "user", password: "pass" }),
    );

    expect(res.status).toBe(200);
    expect(addRateLimitHeaders).toHaveBeenCalled();
  });
});
