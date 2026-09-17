import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Mocks — all declared before any imports (vi.mock is hoisted)
// ---------------------------------------------------------------------------

const mockFetchWithShardFallback = vi.fn();

vi.mock("@/lib/riot-store", () => ({
  fetchWithShardFallback: (...args: unknown[]) => mockFetchWithShardFallback(...args),
}));

vi.mock("@/lib/logger", () => ({
  createLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

import { getPlayerLoadout } from "@/lib/riot-loadout";

const MOCK_TOKENS = {
  accessToken: "test-access-token",
  entitlementsToken: "test-entitlements-token",
  puuid: "test-puuid-1234",
  region: "na",
};

const MOCK_LOADOUT = {
  Subject: "test-puuid-1234",
  Version: 1,
  Identity: {
    PlayerCardID: "card-id",
    PlayerTitleID: "title-id",
    AccountLevel: 42,
    PreferredLevelBorderID: "border-id",
    HideAccountLevel: false,
  },
  Incognito: false,
};

describe("getPlayerLoadout", () => {
  beforeEach(() => {
    mockFetchWithShardFallback.mockReset();
  });

  it("requests the v3 playerloadout endpoint (v2 now returns 404)", async () => {
    mockFetchWithShardFallback.mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve(MOCK_LOADOUT),
    });

    await getPlayerLoadout(MOCK_TOKENS);

    const endpointBuilder = mockFetchWithShardFallback.mock.calls[0]![1] as (pdUrl: string) => string;
    expect(endpointBuilder("https://pd.na.a.pvp.net")).toBe(
      "https://pd.na.a.pvp.net/personalization/v3/players/test-puuid-1234/playerloadout",
    );
  });

  it("returns the parsed loadout", async () => {
    mockFetchWithShardFallback.mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve(MOCK_LOADOUT),
    });

    const result = await getPlayerLoadout(MOCK_TOKENS);

    expect(result.Identity.PlayerCardID).toBe("card-id");
    expect(result.Identity.AccountLevel).toBe(42);
  });

  it("throws when the response is not ok", async () => {
    mockFetchWithShardFallback.mockResolvedValue({ ok: false, status: 500 });

    await expect(getPlayerLoadout(MOCK_TOKENS)).rejects.toThrow("Loadout fetch failed: 500");
  });
});
