import { vi, describe, it, expect, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock("@/lib/riot-auth", () => ({
  completeAuthWithUrl: vi.fn(),
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

const { handleUrlAuth } = await import("@/lib/auth-handlers/url");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const mockTokens = {
  accessToken: "access-tok",
  idToken: "id-tok",
  entitlementsToken: "ent-tok",
  puuid: "test-puuid-1234",
  region: "na",
  riotCookies: "ssid=x",
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
});

describe("handleUrlAuth", () => {
  it("completeAuthWithUrl returns success -> 200 with puuid", async () => {
    const { completeAuthWithUrl } = await import("@/lib/riot-auth");
    vi.mocked(completeAuthWithUrl).mockResolvedValue({
      success: true,
      tokens: mockTokens,
    });

    const { registerAuthenticatedSession } = await import("@/lib/auth-handlers/shared");

    const res = await handleUrlAuth({
      type: "url",
      url: "https://playvalorant.com/opt_in#access_token=abc",
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.puuid).toBe("test-puuid-1234");
    expect(registerAuthenticatedSession).toHaveBeenCalled();
  });

  it("completeAuthWithUrl returns failure -> 401 with error message", async () => {
    const { completeAuthWithUrl } = await import("@/lib/riot-auth");
    vi.mocked(completeAuthWithUrl).mockResolvedValue({
      success: false,
      error: "invalid_url",
    });

    const res = await handleUrlAuth({
      type: "url",
      url: "https://invalid-url.com",
    });

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe("invalid_url");
  });
});
