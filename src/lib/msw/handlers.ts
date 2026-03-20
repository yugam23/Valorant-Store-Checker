/**
 * MSW Request Handlers for E2E Testing
 *
 * This module exports the MSW handler array that intercepts all external HTTP calls
 * during E2E tests: Riot Auth, PD Store, Henrik API, and Valorant-API.
 *
 * Used by instrumentation.ts when ENABLE_MSW=true via setupServer.
 */

import { http, HttpResponse } from "msw";
import {
  getMockUserInfo,
  getMockEntitlements,
  getMockStorefront,
  getMockWallet,
  getMockWeaponSkins,
  getMockContentTiers,
  getMockHenrikAccount,
  getMockHenrikMMR,
} from "./mock-data";

// ---------------------------------------------------------------------------
// API Base URLs (env-aware for testing different regions)
// ---------------------------------------------------------------------------

const RIOT_API_BASE = process.env.RIOT_API_BASE ?? "https://auth.riotgames.com";
const PD_API_BASE = process.env.PD_API_BASE ?? "https://pd.na.a.pvp.net";
const HENRIK_API_BASE = "https://api.henrikdev.xyz";
const VALORANT_API_BASE = "https://valorant-api.com/v1";

// ---------------------------------------------------------------------------
// Handler array
// ---------------------------------------------------------------------------

export const handlers = [
  // ============================================================
  // Riot Auth endpoints
  // ============================================================

  /**
   * POST /api/v1/authorization
   * Handles both initial auth request (no body.type) and
   * credential submission (body.type === "auth").
   */
  http.post(`${RIOT_API_BASE}/api/v1/authorization`, async ({ request }) => {
    const body = await request.json() as Record<string, unknown>;

    if (body.type === undefined) {
      // Initial auth request - return redirect to mock token URL
      return HttpResponse.json(
        {
          type: "response",
          parameters: {
            uri: "https://playvalorant.com/opt_in#access_token=mock_access_token&id_token=mock_id_token",
          },
        },
        {
          headers: {
            "Set-Cookie": "ssid=mock_ssid; Path=/; HttpOnly; SameSite=Lax",
          },
        }
      );
    }

    if (body.type === "auth") {
      // Credential submission - return success with tokens
      return HttpResponse.json(
        {
          type: "response",
          parameters: {
            uri: "https://playvalorant.com/opt_in#access_token=mock_access_token&id_token=mock_id_token",
          },
        },
        {
          headers: {
            "Set-Cookie": [
              "ssid=mock_ssid; Path=/; HttpOnly; SameSite=Lax",
              "clid=mock_clid; Path=/; HttpOnly; SameSite=Lax",
              "csid=mock_csid; Path=/; HttpOnly; SameSite=Lax",
              "tdid=mock_tdid; Path=/; HttpOnly; SameSite=Lax",
            ].join(", "),
          },
        }
      );
    }

    if (body.type === "multifactor") {
      // MFA request - return mock MFA response
      return HttpResponse.json({
        type: "multifactor",
        country: "US",
        multifactor: {
          email: "m***@example.com",
          method: "email",
          methods: ["email"],
          multiFactorCodeLength: 6,
        },
      });
    }

    return HttpResponse.json({ type: "response", parameters: {} }, { status: 400 });
  }),

  /**
   * GET /authorize
   * riot-reauth.ts uses this for cookie-based re-authentication.
   * Returns 302 redirect with tokens in fragment.
   */
  http.get(`${RIOT_API_BASE}/authorize`, ({ request }) => {
    const cookieHeader = request.headers.get("Cookie");
    const hasCookies = cookieHeader && cookieHeader.includes("ssid");

    if (hasCookies) {
      // Cookie present - return redirect with mock tokens
      return new HttpResponse(null, {
        status: 302,
        headers: {
          Location: "https://playvalorant.com/opt_in#access_token=mock_access_token&id_token=mock_id_token",
        },
      });
    }

    // No cookie - prompt for login
    return new HttpResponse(null, {
      status: 401,
      headers: {
        "WWW-Authenticate": 'FormBased realm="riotgames.com"',
      },
    });
  }),

  /**
   * POST /entitlements.auth.riotgames.com/api/token/v1
   * Returns mock entitlements token after token exchange.
   */
  http.post(`${RIOT_API_BASE}/entitlements.auth.riotgames.com/api/token/v1`, () => {
    return HttpResponse.json(getMockEntitlements());
  }),

  /**
   * GET /userinfo
   * Returns mock user info (PUUID, region, game name, tag).
   */
  http.get(`${RIOT_API_BASE}/userinfo`, () => {
    return HttpResponse.json(getMockUserInfo());
  }),

  // ============================================================
  // Riot PD Store endpoints
  // ============================================================

  /**
   * GET /store/v3/storefront/:puuid
   * Returns mock storefront with daily shop skins.
   * Also handles POST variant used by some shards.
   */
  http.get(`${PD_API_BASE}/store/v3/storefront/:puuid`, ({ params }) => {
    const { puuid } = params;
    return HttpResponse.json(getMockStorefront(puuid as string));
  }),

  http.post(`${PD_API_BASE}/store/v3/storefront/:puuid`, ({ params }) => {
    const { puuid } = params;
    return HttpResponse.json(getMockStorefront(puuid as string));
  }),

  /**
   * GET /store/v1/wallet/:puuid
   * Returns mock wallet balances (VP + RP).
   */
  http.get(`${PD_API_BASE}/store/v1/wallet/:puuid`, ({ params }) => {
    const { puuid } = params;
    return HttpResponse.json(getMockWallet(puuid as string));
  }),

  http.post(`${PD_API_BASE}/store/v1/wallet/:puuid`, ({ params }) => {
    const { puuid } = params;
    return HttpResponse.json(getMockWallet(puuid as string));
  }),

  // ============================================================
  // Valorant-API endpoints
  // ============================================================

  /**
   * GET /v1/version
   * Returns mock client version - used by riot-store.ts to
   * construct request headers.
   */
  http.get(`${VALORANT_API_BASE}/v1/version`, () => {
    return HttpResponse.json({
      status: 200,
      data: {
        riotClientVersion: "release-09.06-shipping-20-2635846",
        buildVersion: "09.06.265.18",
        version: "49.0.0.4293977.429",
      },
    });
  }),

  /**
   * GET /v1/weapons/skins
   * Returns mock weapon skins array.
   */
  http.get(`${VALORANT_API_BASE}/v1/weapons/skins`, () => {
    return HttpResponse.json(getMockWeaponSkins());
  }),

  /**
   * GET /v1/contenttiers
   * Returns mock content tiers (rarity levels).
   */
  http.get(`${VALORANT_API_BASE}/v1/contenttiers`, () => {
    return HttpResponse.json(getMockContentTiers());
  }),

  /**
   * GET /v1/bundles
   * Returns empty bundles array (featured bundle handled by storefront).
   */
  http.get(`${VALORANT_API_BASE}/v1/bundles`, () => {
    return HttpResponse.json({
      status: 200,
      data: [],
    });
  }),

  /**
   * GET /v1/competitivetiers
   * Returns mock competitive tiers for rank icon lookup.
   */
  http.get(`${VALORANT_API_BASE}/v1/competitivetiers`, () => {
    return HttpResponse.json({
      status: 200,
      data: [
        {
          uuid: "mock-season-uuid",
          assetPath: "CompetetiveSeasonData/Episode6Act1/Episode6Act1.asset",
          tiers: [
            { tier: 0, largeIcon: null, smallIcon: null, rankTriangleDownIcon: null, rankTriangleUpIcon: null },
            { tier: 1, largeIcon: null, smallIcon: null, rankTriangleDownIcon: null, rankTriangleUpIcon: null },
            { tier: 3, largeIcon: null, smallIcon: null, rankTriangleDownIcon: null, rankTriangleUpIcon: null },
            { tier: 10, largeIcon: null, smallIcon: null, rankTriangleDownIcon: null, rankTriangleUpIcon: null },
            { tier: 11, largeIcon: null, smallIcon: null, rankTriangleDownIcon: null, rankTriangleUpIcon: null },
            { tier: 24, largeIcon: null, smallIcon: null, rankTriangleDownIcon: null, rankTriangleUpIcon: null },
          ],
        },
      ],
    });
  }),

  // ============================================================
  // Henrik API endpoints
  // ============================================================

  /**
   * GET /valorant/v2/by-puuid/account/:region/:puuid
   * Returns mock Henrik account data (name, tag, level, card).
   */
  http.get(`${HENRIK_API_BASE}/valorant/v2/by-puuid/account/:region/:puuid`, ({ params }) => {
    const { puuid } = params;
    return HttpResponse.json({
      status: 200,
      data: getMockHenrikAccount(puuid as string),
    });
  }),

  /**
   * GET /valorant/v3/by-puuid/mmr/:region/pc/:puuid
   * Returns mock Henrik MMR data (rank, RR, peak).
   */
  http.get(`${HENRIK_API_BASE}/valorant/v3/by-puuid/mmr/:region/pc/:puuid`, () => {
    return HttpResponse.json({
      status: 200,
      data: getMockHenrikMMR(),
    });
  }),
];
