import { vi, describe, it, expect, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock("@/lib/riot-auth", () => ({
  submitMfa: vi.fn(),
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

const { handleMfaAuth } = await import("@/lib/auth-handlers/mfa");

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

describe("handleMfaAuth", () => {
  it("submitMfa returns success -> 200 with puuid, calls registerAuthenticatedSession", async () => {
    const { submitMfa } = await import("@/lib/riot-auth");
    vi.mocked(submitMfa).mockResolvedValue({
      success: true,
      tokens: mockTokens,
      riotCookies: "ssid=x",
    });

    const { registerAuthenticatedSession } = await import("@/lib/auth-handlers/shared");

    const res = await handleMfaAuth({
      type: "multifactor",
      code: "123456",
      cookie: "asid=x",
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.puuid).toBe("test-puuid-1234");
    expect(registerAuthenticatedSession).toHaveBeenCalled();
  });

  it("submitMfa returns failure -> 401 with error message", async () => {
    const { submitMfa } = await import("@/lib/riot-auth");
    vi.mocked(submitMfa).mockResolvedValue({
      success: false,
      error: "invalid_code",
    });

    const res = await handleMfaAuth({
      type: "multifactor",
      code: "000000",
      cookie: "asid=x",
    });

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe("invalid_code");
  });
});
