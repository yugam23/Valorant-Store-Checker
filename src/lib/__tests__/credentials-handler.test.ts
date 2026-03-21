import { vi, describe, it, expect, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Mocks — all declared before any imports (vi.mock is hoisted)
// ---------------------------------------------------------------------------

vi.mock("@/lib/riot-auth", () => ({
  authenticateRiotAccount: vi.fn(),
}));

vi.mock("@/lib/browser-auth", () => ({
  authenticateWithBrowser: vi.fn(),
}));

vi.mock("@/lib/session", () => ({
  createSession: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/accounts", () => ({
  addAccount: vi.fn().mockResolvedValue(undefined),
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
// Dynamic import of handler AFTER mocks
// ---------------------------------------------------------------------------

const { handleCredentialsAuth } = await import("@/lib/auth-handlers/credentials");

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

function makeCredentialsBody(
  username: string,
  password: string,
  useBrowser?: boolean,
) {
  return {
    type: "auth" as const,
    username,
    password,
    ...(useBrowser !== undefined ? { useBrowser } : {}),
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
});

describe("handleCredentialsAuth", () => {
  describe("useBrowser=true", () => {
    it("authenticateWithBrowser succeeds -> returns 200 with puuid", async () => {
      const { authenticateWithBrowser } = await import("@/lib/browser-auth");
      vi.mocked(authenticateWithBrowser).mockResolvedValue({
        success: true,
        tokens: mockTokens,
        riotCookies: "ssid=x",
      });

      const res = await handleCredentialsAuth(
        makeCredentialsBody("user", "pass", true),
      );

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.data.puuid).toBe("test-puuid-1234");
    });

    it("authenticateWithBrowser fails -> returns 401", async () => {
      const { authenticateWithBrowser } = await import("@/lib/browser-auth");
      vi.mocked(authenticateWithBrowser).mockResolvedValue({
        success: false,
        error: "browser_failed",
      });

      const res = await handleCredentialsAuth(
        makeCredentialsBody("user", "pass", true),
      );

      expect(res.status).toBe(401);
      const body = await res.json();
      expect(body.error).toBe("browser_failed");
    });
  });

  describe("useBrowser=false (default)", () => {
    it("standard auth succeeds -> returns 200 with puuid (no browser fallback)", async () => {
      const { authenticateRiotAccount } = await import("@/lib/riot-auth");
      vi.mocked(authenticateRiotAccount).mockResolvedValue({
        success: true,
        tokens: mockTokens,
        riotCookies: "ssid=x",
      });

      const { authenticateWithBrowser } = await import("@/lib/browser-auth");

      const res = await handleCredentialsAuth(
        makeCredentialsBody("user", "pass"),
      );

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.data.puuid).toBe("test-puuid-1234");
      expect(authenticateWithBrowser).not.toHaveBeenCalled();
    });

    it("standard auth fails (not MFA), browser succeeds -> falls back to browser, returns 200", async () => {
      const { authenticateRiotAccount } = await import("@/lib/riot-auth");
      vi.mocked(authenticateRiotAccount).mockResolvedValue({
        success: false,
        error: "auth_failure",
      });

      const { authenticateWithBrowser } = await import("@/lib/browser-auth");
      vi.mocked(authenticateWithBrowser).mockResolvedValue({
        success: true,
        tokens: mockTokens,
        riotCookies: "ssid=x",
      });

      const res = await handleCredentialsAuth(
        makeCredentialsBody("user", "pass"),
      );

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.data.puuid).toBe("test-puuid-1234");
    });

    it("standard auth fails (not MFA), browser fails -> returns 401 with browser error", async () => {
      const { authenticateRiotAccount } = await import("@/lib/riot-auth");
      vi.mocked(authenticateRiotAccount).mockResolvedValue({
        success: false,
        error: "auth_failure",
      });

      const { authenticateWithBrowser } = await import("@/lib/browser-auth");
      vi.mocked(authenticateWithBrowser).mockResolvedValue({
        success: false,
        error: "browser_failed",
      });

      const res = await handleCredentialsAuth(
        makeCredentialsBody("user", "pass"),
      );

      expect(res.status).toBe(401);
      const body = await res.json();
      expect(body.error).toBe("browser_failed");
    });

    it("standard auth returns MFA challenge -> returns 200 with requiresMfa:true", async () => {
      const { authenticateRiotAccount } = await import("@/lib/riot-auth");
      vi.mocked(authenticateRiotAccount).mockResolvedValue({
        success: false,
        type: "multifactor",
        cookie: "asid=x",
        multifactor: { email: "u@example.com", method: "email" },
      });

      const { authenticateWithBrowser } = await import("@/lib/browser-auth");

      const res = await handleCredentialsAuth(
        makeCredentialsBody("user", "pass"),
      );

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.requiresMfa).toBe(true);
      expect(body.cookie).toBe("asid=x");
      expect(authenticateWithBrowser).not.toHaveBeenCalled();
    });
  });

  describe("success path edge cases", () => {
    it("result.success but no tokens (tokens: null) -> returns 500", async () => {
      const { authenticateRiotAccount } = await import("@/lib/riot-auth");
      vi.mocked(authenticateRiotAccount).mockResolvedValue({
        success: true,
        tokens: null,
      });

      const res = await handleCredentialsAuth(
        makeCredentialsBody("user", "pass"),
      );

      expect(res.status).toBe(500);
      const body = await res.json();
      expect(body.error).toBeTruthy();
    });

    it("result.success with tokens, no riotCookies -> still returns 200", async () => {
      const { authenticateRiotAccount } = await import("@/lib/riot-auth");
      vi.mocked(authenticateRiotAccount).mockResolvedValue({
        success: true,
        tokens: mockTokens,
      });

      const res = await handleCredentialsAuth(
        makeCredentialsBody("user", "pass"),
      );

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
    });
  });
});
