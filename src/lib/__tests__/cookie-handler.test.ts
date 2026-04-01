import { vi, describe, it, expect, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock("@/lib/riot-reauth", () => ({
  refreshTokensWithCookies: vi.fn(),
}));

vi.mock("@/lib/rate-limiter", () => ({
  rateLimit: vi.fn(),
}));

vi.mock("@/lib/auth-handlers/shared", () => ({
  registerAuthenticatedSession: vi.fn().mockResolvedValue(undefined),
  log: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// ---------------------------------------------------------------------------
// Dynamic import
// ---------------------------------------------------------------------------

const { handleCookieAuth } = await import("@/lib/auth-handlers/cookie");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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

describe("handleCookieAuth", () => {
  it("refreshTokensWithCookies returns success -> 200 with puuid", async () => {
    const { refreshTokensWithCookies } = await import("@/lib/riot-reauth");
    vi.mocked(refreshTokensWithCookies).mockResolvedValue({
      success: true,
      tokens: mockTokens,
      riotCookies: "ssid=new",
    });

    const { registerAuthenticatedSession } = await import("@/lib/auth-handlers/shared");

    const res = await handleCookieAuth({
      type: "cookie",
      cookie: "ssid=old",
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.puuid).toBe("test-puuid-1234");
    expect(registerAuthenticatedSession).toHaveBeenCalled();
  });

  it("refreshTokensWithCookies returns failure -> 401 with error message", async () => {
    const { refreshTokensWithCookies } = await import("@/lib/riot-reauth");
    vi.mocked(refreshTokensWithCookies).mockResolvedValue({
      success: false,
      error: "cookie_expired",
    });

    const res = await handleCookieAuth({
      type: "cookie",
      cookie: "ssid=expired",
    });

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe("cookie_expired");
  });

  it("with headers + rate limit exceeded -> 429 with rate limit headers", async () => {
    const { rateLimit } = await import("@/lib/rate-limiter");
    vi.mocked(rateLimit).mockResolvedValue({
      success: false,
      limit: 5,
      remaining: 0,
      reset: Date.now() + 60000,
    });

    const headers = new Headers();
    headers.set("x-forwarded-for", "1.2.3.4");

    const res = await handleCookieAuth(
      { type: "cookie", cookie: "ssid=old" },
      headers,
    );

    expect(res.status).toBe(429);
    expect(res.headers.get("X-RateLimit-Limit")).toBe("5");
    expect(res.headers.get("X-RateLimit-Remaining")).toBe("0");
    const body = await res.json();
    expect(body.error).toBe("Too many requests. Please try again later.");
  });

  it("with headers + auth failure -> 401 with rate limit headers and error", async () => {
    const { rateLimit } = await import("@/lib/rate-limiter");
    vi.mocked(rateLimit).mockResolvedValue({
      success: true,
      limit: 5,
      remaining: 4,
      reset: Date.now() + 60000,
    });

    const { refreshTokensWithCookies } = await import("@/lib/riot-reauth");
    vi.mocked(refreshTokensWithCookies).mockResolvedValue({
      success: false,
      error: "session_expired",
    });

    const headers = new Headers();
    headers.set("x-real-ip", "9.9.9.9");

    const res = await handleCookieAuth(
      { type: "cookie", cookie: "ssid=old" },
      headers,
    );

    expect(res.status).toBe(401);
    expect(res.headers.get("X-RateLimit-Limit")).toBe("5");
    expect(res.headers.get("X-RateLimit-Remaining")).toBe("4");
    const body = await res.json();
    expect(body.error).toBe("session_expired");
  });

  it("with headers + auth success -> 200 with puuid and region", async () => {
    const { rateLimit } = await import("@/lib/rate-limiter");
    vi.mocked(rateLimit).mockResolvedValue({
      success: true,
      limit: 5,
      remaining: 4,
      reset: Date.now() + 60000,
    });

    const { refreshTokensWithCookies } = await import("@/lib/riot-reauth");
    vi.mocked(refreshTokensWithCookies).mockResolvedValue({
      success: true,
      tokens: mockTokens,
      riotCookies: "ssid=fresh",
    });

    const headers = new Headers();
    headers.set("x-forwarded-for", "1.2.3.4, 5.6.7.8");

    const res = await handleCookieAuth(
      { type: "cookie", cookie: "ssid=old" },
      headers,
    );

    expect(res.status).toBe(200);
    expect(res.headers.get("X-RateLimit-Limit")).toBe("5");
    expect(res.headers.get("X-RateLimit-Remaining")).toBe("4");
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.puuid).toBe("test-puuid-1234");
    expect(body.data.region).toBe("na");
  });
});
