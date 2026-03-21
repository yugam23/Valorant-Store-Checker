import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ProfileData } from "@/lib/profile-cache";

// ---------------------------------------------------------------------------
// Mock dependencies — all declared before any imports (vi.mock is hoisted)
// ---------------------------------------------------------------------------

const mockRedisGet = vi.fn();
const mockRedisSet = vi.fn();
const mockRedisDel = vi.fn();
const mockRedisScan = vi.fn();

vi.mock("@/lib/redis-client", () => ({
  redis: {
    get: (...args: unknown[]) => mockRedisGet(...args),
    set: (...args: unknown[]) => mockRedisSet(...args),
    del: (...args: unknown[]) => mockRedisDel(...args),
    scan: (...args: unknown[]) => mockRedisScan(...args),
  },
}));

const mockGetPlayerLoadout = vi.fn();
vi.mock("@/lib/riot-loadout", () => ({
  getPlayerLoadout: (...args: unknown[]) => mockGetPlayerLoadout(...args),
}));

const mockGetHenrikAccount = vi.fn();
const mockGetHenrikMMR = vi.fn();
vi.mock("@/lib/henrik-api", () => ({
  getHenrikAccount: (...args: unknown[]) => mockGetHenrikAccount(...args),
  getHenrikMMR: (...args: unknown[]) => mockGetHenrikMMR(...args),
}));

const mockGetPlayerCardByUuid = vi.fn();
const mockGetPlayerTitleByUuid = vi.fn();
const mockGetCompetitiveTierIconByTier = vi.fn();
vi.mock("@/lib/valorant-api", () => ({
  getPlayerCardByUuid: (...args: unknown[]) => mockGetPlayerCardByUuid(...args),
  getPlayerTitleByUuid: (...args: unknown[]) => mockGetPlayerTitleByUuid(...args),
  getCompetitiveTierIconByTier: (...args: unknown[]) => mockGetCompetitiveTierIconByTier(...args),
}));

vi.mock("@/lib/logger", () => ({
  createLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

// ---------------------------------------------------------------------------
// Import module under test AFTER mocks are declared
// ---------------------------------------------------------------------------

const { getProfileData, clearProfileCache } = await import("@/lib/profile-cache");

// ---------------------------------------------------------------------------
// Helper factories
// ---------------------------------------------------------------------------

function makeTokens(puuid = "test-puuid", region = "na") {
  return {
    accessToken: "test-access-token",
    entitlementsToken: "test-entitlements-token",
    puuid,
    region,
  };
}

function makeCacheEntry(data: ProfileData, cachedAt: number = Date.now() - 60000) {
  return JSON.stringify({ data, cachedAt });
}

function makeMockLoadout(overrides: Partial<{ PlayerCardID: string; PlayerTitleID: string; AccountLevel: number; HideAccountLevel: boolean }> = {}) {
  return {
    Identity: {
      PlayerCardID: "card-uuid-1",
      PlayerTitleID: "title-uuid-1",
      AccountLevel: 42,
      HideAccountLevel: false,
      ...overrides,
    },
    Guns: [],
    Sprays: [],
  };
}

function makeMockAccount(overrides: Partial<{ name: string; tag: string; account_level: number }> = {}) {
  return {
    puuid: "test-puuid",
    region: "na",
    name: "TestPlayer",
    tag: "NA1",
    account_level: 99,
    ...overrides,
  };
}

function makeMockMMR(overrides: Partial<{ current: object; peak: object }> = {}) {
  return {
    current: {
      tier: { id: 10, name: "Gold 1" },
      rr: 55,
      last_change: 12,
    },
    peak: {
      tier: { id: 12, name: "Platinum 1" },
    },
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
  mockRedisSet.mockResolvedValue("OK");
  mockRedisDel.mockResolvedValue(1);
  mockRedisScan.mockResolvedValue(["0", []]);
});

describe("getProfileData — Tier 0 (cache)", () => {
  it("Tier 0: fresh cache hit (< 5min) returns with fromCache:true, does NOT call any APIs", async () => {
    const cachedProfile: ProfileData = {
      playerCardId: "card-123",
      fromCache: false,
      partial: false,
      henrikFailed: false,
    };
    mockRedisGet.mockResolvedValue(makeCacheEntry(cachedProfile, Date.now() - 60000)); // 1 min ago

    const result = await getProfileData(makeTokens(), "na");

    expect(result.fromCache).toBe(true);
    expect(mockGetPlayerLoadout).not.toHaveBeenCalled();
    expect(mockGetHenrikAccount).not.toHaveBeenCalled();
    expect(mockGetHenrikMMR).not.toHaveBeenCalled();
  });

  it("Tier 0: stale cache (>= 5min) proceeds to Tier 1 API fetch", async () => {
    const cachedProfile: ProfileData = {
      playerCardId: "card-123",
      fromCache: false,
      partial: false,
      henrikFailed: false,
    };
    mockRedisGet.mockResolvedValue(makeCacheEntry(cachedProfile, Date.now() - 400000)); // ~6.6 min ago

    mockGetPlayerLoadout.mockResolvedValue(makeMockLoadout());
    mockGetHenrikAccount.mockResolvedValue(makeMockAccount());
    mockGetHenrikMMR.mockResolvedValue(makeMockMMR());
    mockGetPlayerCardByUuid.mockResolvedValue({ smallArt: "", wideArt: "", largeArt: "" });
    mockGetPlayerTitleByUuid.mockResolvedValue({ titleText: "Test Title" });
    mockGetCompetitiveTierIconByTier.mockResolvedValue("https://ranked.icon");

    const result = await getProfileData(makeTokens(), "na");

    // Should have gone to Tier 1 (API fetch happened)
    expect(mockGetPlayerLoadout).toHaveBeenCalled();
    expect(result.fromCache).toBe(false);
  });

  it("Tier 0: malformed cache entry triggers redis.del and proceeds to Tier 1", async () => {
    mockRedisGet.mockResolvedValue("{invalid-json");
    mockRedisDel.mockResolvedValue(1);

    mockGetPlayerLoadout.mockResolvedValue(makeMockLoadout());
    mockGetHenrikAccount.mockResolvedValue(makeMockAccount());
    mockGetHenrikMMR.mockResolvedValue(makeMockMMR());
    mockGetPlayerCardByUuid.mockResolvedValue({ smallArt: "", wideArt: "", largeArt: "" });
    mockGetPlayerTitleByUuid.mockResolvedValue({ titleText: "Test Title" });
    mockGetCompetitiveTierIconByTier.mockResolvedValue("https://ranked.icon");

    const result = await getProfileData(makeTokens(), "na");

    expect(mockRedisDel).toHaveBeenCalled();
    expect(mockGetPlayerLoadout).toHaveBeenCalled();
    expect(result.fromCache).toBe(false);
  });
});

describe("getProfileData — Tier 1 (API fetch)", () => {
  it("Tier 1: all APIs succeed → partial:false, result cached", async () => {
    mockRedisGet.mockResolvedValue(null);

    mockGetPlayerLoadout.mockResolvedValue(makeMockLoadout());
    mockGetHenrikAccount.mockResolvedValue(makeMockAccount());
    mockGetHenrikMMR.mockResolvedValue(makeMockMMR());
    mockGetPlayerCardByUuid.mockResolvedValue({
      smallArt: "https://card.small",
      wideArt: "https://card.wide",
      largeArt: "https://card.large",
    });
    mockGetPlayerTitleByUuid.mockResolvedValue({ titleText: "Champion" });
    mockGetCompetitiveTierIconByTier.mockResolvedValue("https://ranked.icon");

    const result = await getProfileData(makeTokens(), "na");

    expect(result.partial).toBe(false);
    expect(result.henrikFailed).toBe(false);
    expect(mockRedisSet).toHaveBeenCalled(); // cached
  });

  it("Tier 1: redis.get rejects with timeout → proceeds to API fetch (does not throw)", async () => {
    mockRedisGet.mockRejectedValue(new Error("Redis timeout exceeded"));
    mockRedisSet.mockResolvedValue("OK");
    mockRedisDel.mockResolvedValue(1);

    mockGetPlayerLoadout.mockResolvedValue(makeMockLoadout());
    mockGetHenrikAccount.mockResolvedValue(makeMockAccount());
    mockGetHenrikMMR.mockResolvedValue(makeMockMMR());
    mockGetPlayerCardByUuid.mockResolvedValue({ smallArt: "", wideArt: "", largeArt: "" });
    mockGetPlayerTitleByUuid.mockResolvedValue({ titleText: "Title" });
    mockGetCompetitiveTierIconByTier.mockResolvedValue("https://ranked.icon");

    const result = await getProfileData(makeTokens(), "na");

    // Should fall through to API fetch since cache read failed
    expect(mockGetPlayerLoadout).toHaveBeenCalled();
    expect(result.partial).toBe(false);
  });

  it("Tier 1: loadout fails, Henrik succeeds → partial:false, henrikFailed:false", async () => {
    mockRedisGet.mockResolvedValue(null);

    mockGetPlayerLoadout.mockRejectedValue(new Error("Riot timeout"));
    mockGetHenrikAccount.mockResolvedValue(makeMockAccount({ name: "OnlyHenrik", tag: "TAG1" }));
    mockGetHenrikMMR.mockResolvedValue(makeMockMMR());
    mockGetCompetitiveTierIconByTier.mockResolvedValue("https://ranked.icon");

    const result = await getProfileData(makeTokens(), "na");

    expect(result.partial).toBe(false);
    expect(result.henrikFailed).toBe(false);
    expect(result.playerCardId).toBeUndefined();
    expect(result.henrikName).toBe("OnlyHenrik");
  });

  it("Tier 1: Henrik account fails → henrikFailed:true, still partial:false if loadout succeeded", async () => {
    mockRedisGet.mockResolvedValue(null);

    mockGetPlayerLoadout.mockResolvedValue(makeMockLoadout());
    mockGetHenrikAccount.mockRejectedValue(new Error("Henrik down"));
    mockGetHenrikMMR.mockResolvedValue(makeMockMMR());
    mockGetPlayerCardByUuid.mockResolvedValue({ smallArt: "", wideArt: "", largeArt: "" });
    mockGetPlayerTitleByUuid.mockResolvedValue({ titleText: "Title" });
    mockGetCompetitiveTierIconByTier.mockResolvedValue("https://ranked.icon");

    const result = await getProfileData(makeTokens(), "na");

    expect(result.partial).toBe(false);
    expect(result.henrikFailed).toBe(true);
  });
});

describe("getProfileData — Tier 2 (stale-while-revalidate)", () => {
  it("Tier 2: all APIs fail + stale cache exists → returns stale data with fromCache:true", async () => {
    const staleProfile: ProfileData = {
      playerCardId: "stale-card",
      fromCache: false,
      partial: false,
      henrikFailed: false,
    };
    mockRedisGet.mockResolvedValue(makeCacheEntry(staleProfile, Date.now() - 3600000)); // stale entry

    mockGetPlayerLoadout.mockRejectedValue(new Error("Riot down"));
    mockGetHenrikAccount.mockRejectedValue(new Error("Henrik down"));
    mockGetHenrikMMR.mockRejectedValue(new Error("MMR down"));

    const result = await getProfileData(makeTokens(), "na");

    expect(result.fromCache).toBe(true);
    expect(result.partial).toBe(false); // got stale data
  });

  it("Tier 2: all APIs fail + malformed stale cache → falls through to Tier 3", async () => {
    mockRedisGet.mockResolvedValue("{malformed");
    mockRedisDel.mockResolvedValue(1);

    mockGetPlayerLoadout.mockRejectedValue(new Error("Riot down"));
    mockGetHenrikAccount.mockRejectedValue(new Error("Henrik down"));
    mockGetHenrikMMR.mockRejectedValue(new Error("MMR down"));

    const result = await getProfileData(makeTokens(), "na");

    // Falls through to Tier 3
    expect(result.partial).toBe(true);
    expect(result.henrikFailed).toBe(true);
  });
});

describe("getProfileData — Tier 3 (total failure)", () => {
  it("Tier 3: all APIs fail + no cache → returns partial:true, henrikFailed:true", async () => {
    mockRedisGet.mockResolvedValue(null);

    mockGetPlayerLoadout.mockRejectedValue(new Error("Riot down"));
    mockGetHenrikAccount.mockRejectedValue(new Error("Henrik down"));
    mockGetHenrikMMR.mockRejectedValue(new Error("MMR down"));

    const result = await getProfileData(makeTokens(), "na");

    expect(result.partial).toBe(true);
    expect(result.henrikFailed).toBe(true);
    expect(mockRedisSet).not.toHaveBeenCalled(); // partial data not cached
  });
});

describe("clearProfileCache", () => {
  it("with puuid: calls redis.del with correct key", async () => {
    await clearProfileCache("test-puuid");

    expect(mockRedisDel).toHaveBeenCalledWith("profile:test-puuid");
  });

  it("without puuid: scans and deletes all profile keys", async () => {
    mockRedisScan
      .mockResolvedValueOnce(["5", ["profile:puuid1", "profile:puuid2"]])
      .mockResolvedValueOnce(["0", ["profile:puuid3"]]);

    await clearProfileCache();

    expect(mockRedisScan).toHaveBeenCalled();
    expect(mockRedisDel).toHaveBeenCalledTimes(3);
    expect(mockRedisDel).toHaveBeenCalledWith("profile:puuid1");
    expect(mockRedisDel).toHaveBeenCalledWith("profile:puuid2");
    expect(mockRedisDel).toHaveBeenCalledWith("profile:puuid3");
  });
});
