import { describe, it, expect, beforeAll, afterEach, afterAll } from "vitest";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";

// ---------------------------------------------------------------------------
// Constants (matching riot-tokens.ts)
// ---------------------------------------------------------------------------
const RIOT_AUTH_URL = "https://auth.riotgames.com/api/v1/authorization";
const RIOT_ENTITLEMENTS_URL = "https://entitlements.auth.riotgames.com/api/token/v1";
const RIOT_USERINFO_URL = "https://auth.riotgames.com/userinfo";
const RIOT_AUTHORIZE_URL = "https://auth.riotgames.com/authorize";

// ---------------------------------------------------------------------------
// Default MSW handlers (success path)
// ---------------------------------------------------------------------------

const handlers = [
  // Step 1: POST /api/v1/authorization — init session
  http.post(RIOT_AUTH_URL, () => {
    return new HttpResponse(
      JSON.stringify({ type: "auth" }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Set-Cookie": "asid=init-session-id; Path=/; HttpOnly",
        },
      },
    );
  }),

  // Step 2: PUT /api/v1/authorization — submit credentials (default: success)
  http.put(RIOT_AUTH_URL, () => {
    return new HttpResponse(
      JSON.stringify({
        type: "response",
        response: {
          parameters: {
            uri: "https://playvalorant.com/opt_in#access_token=test-access-token&id_token=test-id-token&token_type=Bearer",
          },
        },
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Set-Cookie": "ssid=original-long-lived-ssid; Path=/; HttpOnly",
        },
      },
    );
  }),

  // Step 3: POST entitlements
  http.post(RIOT_ENTITLEMENTS_URL, () => {
    return HttpResponse.json({ entitlements_token: "test-entitlements-token" });
  }),

  // Step 4: GET userinfo
  http.get(RIOT_USERINFO_URL, () => {
    return HttpResponse.json({
      sub: "test-puuid",
      country: "US",
      email_verified: true,
      phone_number_verified: true,
      account_verified: true,
      age: 25,
      jti: "test-jti",
    });
  }),
];

const server = setupServer(...handlers);

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

// ---------------------------------------------------------------------------
// authenticateRiotAccount tests
// ---------------------------------------------------------------------------

describe("authenticateRiotAccount", () => {
  it("success path: returns tokens with correct values", async () => {
    const { authenticateRiotAccount } = await import("@/lib/riot-auth");
    const result = await authenticateRiotAccount("user", "pass");

    expect(result.success).toBe(true);

    if (result.success) {
      expect(result.tokens.accessToken).toBe("test-access-token");
      expect(result.tokens.puuid).toBe("test-puuid");
      expect(result.tokens.entitlementsToken).toBe("test-entitlements-token");
      expect(result.tokens.region).toBe("na");
    }
  });

  it("MFA required: returns success=false with type='multifactor'", async () => {
    server.use(
      http.put(RIOT_AUTH_URL, () => {
        return HttpResponse.json({
          type: "multifactor",
          multifactor: { email: "u***@example.com", method: "email" },
        });
      }),
    );

    const { authenticateRiotAccount } = await import("@/lib/riot-auth");
    const result = await authenticateRiotAccount("user", "pass");

    expect(result.success).toBe(false);
    if (!result.success && "type" in result) {
      expect(result.type).toBe("multifactor");
    }
  });

  it("auth error response: returns success=false with error field", async () => {
    server.use(
      http.put(RIOT_AUTH_URL, () => {
        return HttpResponse.json({ type: "error", error: "auth_failure" });
      }),
    );

    const { authenticateRiotAccount } = await import("@/lib/riot-auth");
    const result = await authenticateRiotAccount("user", "pass");

    expect(result.success).toBe(false);
    if (!result.success) {
      expect("error" in result).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// refreshTokensWithCookies tests
// ---------------------------------------------------------------------------

describe("refreshTokensWithCookies", () => {
  it("success path: SSID preserved (original ssid kept, not response ssid)", async () => {
    server.use(
      http.get(RIOT_AUTHORIZE_URL, () => {
        return new HttpResponse(null, {
          status: 303,
          headers: {
            Location:
              "https://playvalorant.com/opt_in#access_token=refreshed-token&id_token=refreshed-id-token&token_type=Bearer",
            "Set-Cookie": "ssid=new-session-ssid; Path=/",
          },
        });
      }),
      http.post(RIOT_ENTITLEMENTS_URL, () => {
        return HttpResponse.json({ entitlements_token: "refreshed-entitlements" });
      }),
      http.get(RIOT_USERINFO_URL, () => {
        return HttpResponse.json({
          sub: "test-puuid",
          country: "US",
          email_verified: true,
          phone_number_verified: true,
          account_verified: true,
          age: 25,
          jti: "test-jti",
        });
      }),
    );

    const { refreshTokensWithCookies } = await import("@/lib/riot-reauth");
    const result = await refreshTokensWithCookies(
      "ssid=original-long-lived-ssid; clid=test-clid",
    );

    expect(result.success).toBe(true);

    if (result.success) {
      expect(result.tokens.accessToken).toBe("refreshed-token");
      // The original ssid must be preserved — NOT "new-session-ssid"
      expect(result.riotCookies).toContain("original-long-lived-ssid");
      expect(result.riotCookies).not.toContain("new-session-ssid");
    }
  });

  it("expired session: GET /authorize redirects to login page → success=false", async () => {
    server.use(
      http.get(RIOT_AUTHORIZE_URL, () => {
        return new HttpResponse(null, {
          status: 303,
          headers: {
            Location: "https://authenticate.riotgames.com/login",
          },
        });
      }),
    );

    const { refreshTokensWithCookies } = await import("@/lib/riot-reauth");
    const result = await refreshTokensWithCookies("ssid=expired-ssid");

    expect(result.success).toBe(false);
  });
});
