import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Mock dependencies — all declared before any imports (vi.mock is hoisted)
// ---------------------------------------------------------------------------

const mockRedisGet = vi.fn();
const mockRedisSet = vi.fn();
const mockRedisDel = vi.fn();

vi.mock("@/lib/redis-client", () => ({
  redis: {
    get: (...args: unknown[]) => mockRedisGet(...args),
    set: (...args: unknown[]) => mockRedisSet(...args),
    del: (...args: unknown[]) => mockRedisDel(...args),
  },
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

const {
  getWeaponSkins,
  getContentTiers,
  getBundles,
  getPlayerCardByUuid,
  getPlayerTitleByUuid,
  getCompetitiveTierIconByTier,
  getSkinVideo,
  clearCache,
} = await import("@/lib/valorant-api");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const MOCK_SKINS_DATA = [
  { uuid: "skin-1", displayName: "Vandal", displayIcon: "icon.png", levels: [], chromas: [], contentTierUuid: null },
];
const MOCK_TIERS_DATA = [
  { uuid: "tier-1", displayName: "Select", rankTier: 1, color: "#fff", levels: [] },
];
const MOCK_BUNDLES_DATA = [
  { uuid: "bundle-1", displayName: "Premium Bundle", displayIcon: "bundle.png" },
];
const MOCK_COMPETITIVE_DATA = [
  {
    uuid: "season-1",
    tiers: [
      { tier: 0, largeIcon: null },
      { tier: 3, largeIcon: "https://ranked/iron.png" },
      { tier: 10, largeIcon: "https://ranked/gold.png" },
      { tier: 24, largeIcon: "https://ranked/radiant.png" },
    ],
  },
];

function makeCachedPayload<T>(data: T, timestamp: number = Date.now() - 3600000) {
  return JSON.stringify({ data, timestamp });
}

function makeValidApiResponse(data: unknown, status = 200) {
  return { status, data };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
  vi.restoreAllMocks();
  mockRedisSet.mockResolvedValue("OK");
  mockRedisDel.mockResolvedValue(1);
});

describe("getWeaponSkins", () => {
  it("cache hit: returns data without fetch", async () => {
    mockRedisGet.mockResolvedValue(makeCachedPayload(MOCK_SKINS_DATA));

    const result = await getWeaponSkins();

    expect(result).toEqual(MOCK_SKINS_DATA);
    expect(mockRedisGet).toHaveBeenCalled();
  });

  it("cache miss, fetch succeeds (200): stores in cache, returns data", async () => {
    mockRedisGet.mockResolvedValue(null);
    vi.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => makeValidApiResponse(MOCK_SKINS_DATA),
    } as Response);

    const result = await getWeaponSkins();

    expect(result).toEqual(MOCK_SKINS_DATA);
    expect(mockRedisSet).toHaveBeenCalled();
  });

  it("cache miss, fetch returns non-200: throws error", async () => {
    mockRedisGet.mockResolvedValue(null);
    vi.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: false,
      status: 500,
      statusText: "Internal Server Error",
    } as Response);

    await expect(getWeaponSkins()).rejects.toThrow();
  });

  it("cache miss, fetch throws, stale cache exists: returns stale data", async () => {
    mockRedisGet
      .mockResolvedValueOnce(null) // first getCache call (fresh check)
      .mockResolvedValueOnce(makeCachedPayload(MOCK_SKINS_DATA)); // getStaleCache call
    vi.spyOn(global, "fetch").mockRejectedValueOnce(new Error("Network failure"));

    const result = await getWeaponSkins();

    expect(result).toEqual(MOCK_SKINS_DATA);
  });

  it("cache miss, fetch throws, no stale cache: throws original error", async () => {
    mockRedisGet.mockResolvedValue(null);
    vi.spyOn(global, "fetch").mockRejectedValueOnce(new Error("Network failure"));

    await expect(getWeaponSkins()).rejects.toThrow("Network failure");
  });
});

describe("getContentTiers", () => {
  it("cache hit: returns data without fetch", async () => {
    mockRedisGet.mockResolvedValue(makeCachedPayload(MOCK_TIERS_DATA));

    const result = await getContentTiers();

    expect(result).toEqual(MOCK_TIERS_DATA);
  });

  it("cache miss, fetch succeeds (200): stores in cache, returns data", async () => {
    mockRedisGet.mockResolvedValue(null);
    vi.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => makeValidApiResponse(MOCK_TIERS_DATA),
    } as Response);

    const result = await getContentTiers();

    expect(result).toEqual(MOCK_TIERS_DATA);
    expect(mockRedisSet).toHaveBeenCalled();
  });

  it("cache miss, fetch returns non-200: throws error", async () => {
    mockRedisGet.mockResolvedValue(null);
    vi.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: false,
      status: 404,
      statusText: "Not Found",
    } as Response);

    await expect(getContentTiers()).rejects.toThrow();
  });

  it("cache miss, fetch throws, stale cache exists: returns stale data", async () => {
    mockRedisGet
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(makeCachedPayload(MOCK_TIERS_DATA));
    vi.spyOn(global, "fetch").mockRejectedValueOnce(new Error("Network failure"));

    const result = await getContentTiers();

    expect(result).toEqual(MOCK_TIERS_DATA);
  });

  it("cache miss, fetch throws, no stale cache: throws original error", async () => {
    mockRedisGet.mockResolvedValue(null);
    vi.spyOn(global, "fetch").mockRejectedValueOnce(new Error("Network failure"));

    await expect(getContentTiers()).rejects.toThrow("Network failure");
  });
});

describe("getBundles", () => {
  it("cache hit: returns data without fetch", async () => {
    mockRedisGet.mockResolvedValue(makeCachedPayload(MOCK_BUNDLES_DATA));

    const result = await getBundles();

    expect(result).toEqual(MOCK_BUNDLES_DATA);
  });

  it("cache miss, fetch succeeds (200): stores in cache, returns data", async () => {
    mockRedisGet.mockResolvedValue(null);
    vi.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => makeValidApiResponse(MOCK_BUNDLES_DATA),
    } as Response);

    const result = await getBundles();

    expect(result).toEqual(MOCK_BUNDLES_DATA);
    expect(mockRedisSet).toHaveBeenCalled();
  });

  it("cache miss, fetch returns non-200: throws error", async () => {
    mockRedisGet.mockResolvedValue(null);
    vi.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: false,
      status: 503,
      statusText: "Service Unavailable",
    } as Response);

    await expect(getBundles()).rejects.toThrow();
  });

  it("cache miss, fetch throws, stale cache exists: returns stale data", async () => {
    mockRedisGet
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(makeCachedPayload(MOCK_BUNDLES_DATA));
    vi.spyOn(global, "fetch").mockRejectedValueOnce(new Error("Network failure"));

    const result = await getBundles();

    expect(result).toEqual(MOCK_BUNDLES_DATA);
  });

  it("cache miss, fetch throws, no stale cache: throws original error", async () => {
    mockRedisGet.mockResolvedValue(null);
    vi.spyOn(global, "fetch").mockRejectedValueOnce(new Error("Network failure"));

    await expect(getBundles()).rejects.toThrow("Network failure");
  });
});

describe("getPlayerCardByUuid", () => {
  it("fetch succeeds (200): returns ValorantPlayerCard object", async () => {
    const cardData = {
      uuid: "card-1",
      displayName: "Player Card",
      isHiddenIfNotOwned: false,
      themeUuid: null,
      displayIcon: null,
      smallArt: "https://small.png",
      wideArt: "https://wide.png",
      largeArt: "https://large.png",
      assetPath: "asset",
    };
    vi.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ status: 200, data: cardData }),
    } as Response);

    const result = await getPlayerCardByUuid("card-1");

    expect(result).toEqual(cardData);
  });

  it("fetch fails (non-ok): returns null without throwing", async () => {
    vi.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: false,
      status: 404,
    } as Response);

    const result = await getPlayerCardByUuid("invalid-card");

    expect(result).toBeNull();
  });

  it("fetch throws: returns null without throwing", async () => {
    vi.spyOn(global, "fetch").mockRejectedValueOnce(new Error("Network failure"));

    const result = await getPlayerCardByUuid("card-1");

    expect(result).toBeNull();
  });
});

describe("getPlayerTitleByUuid", () => {
  it("fetch succeeds (200): returns ValorantPlayerTitle object", async () => {
    const titleData = {
      uuid: "title-1",
      displayName: "Player Title",
      titleText: "MVP",
      isHiddenIfNotOwned: false,
      assetPath: "asset",
    };
    vi.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ status: 200, data: titleData }),
    } as Response);

    const result = await getPlayerTitleByUuid("title-1");

    expect(result).toEqual(titleData);
  });

  it("fetch fails (non-ok): returns null without throwing", async () => {
    vi.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: false,
      status: 500,
    } as Response);

    const result = await getPlayerTitleByUuid("invalid-title");

    expect(result).toBeNull();
  });

  it("fetch throws: returns null without throwing", async () => {
    vi.spyOn(global, "fetch").mockRejectedValueOnce(new Error("Network failure"));

    const result = await getPlayerTitleByUuid("title-1");

    expect(result).toBeNull();
  });
});

describe("getCompetitiveTierIconByTier", () => {
  it("cache hit: returns cached largeIcon string", async () => {
    mockRedisGet.mockResolvedValue(makeCachedPayload(MOCK_COMPETITIVE_DATA));

    const result = await getCompetitiveTierIconByTier(10);

    expect(result).toBe("https://ranked/gold.png");
  });

  it("cache miss, fetch succeeds: fetches, stores, returns correct tier's largeIcon", async () => {
    mockRedisGet.mockResolvedValue(null);
    vi.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ data: MOCK_COMPETITIVE_DATA }),
    } as Response);

    const result = await getCompetitiveTierIconByTier(24);

    expect(result).toBe("https://ranked/radiant.png");
    expect(mockRedisSet).toHaveBeenCalled();
  });

  it("cache miss, fetch fails with stale: returns stale largeIcon", async () => {
    mockRedisGet
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(makeCachedPayload(MOCK_COMPETITIVE_DATA));
    vi.spyOn(global, "fetch").mockRejectedValueOnce(new Error("Network failure"));

    const result = await getCompetitiveTierIconByTier(3);

    expect(result).toBe("https://ranked/iron.png");
  });

  it("cache miss, fetch fails without stale: returns null", async () => {
    mockRedisGet.mockResolvedValue(null);
    vi.spyOn(global, "fetch").mockRejectedValueOnce(new Error("Network failure"));

    const result = await getCompetitiveTierIconByTier(10);

    expect(result).toBeNull();
  });
});

describe("getSkinVideo", () => {
  it("no levels array: returns null", () => {
    const skin = { uuid: "skin-1", levels: null };
    expect(getSkinVideo(skin as any)).toBeNull();
  });

  it("levels exist but no streamedVideo: returns null", () => {
    const skin = { uuid: "skin-1", levels: [{ uuid: "l1", streamedVideo: null }, { uuid: "l2", streamedVideo: "" }] };
    expect(getSkinVideo(skin as any)).toBeNull();
  });

  it("levels with streamedVideo: returns the video URL", () => {
    const skin = {
      uuid: "skin-1",
      levels: [
        { uuid: "l1", streamedVideo: null },
        { uuid: "l2", streamedVideo: "" },
        { uuid: "l3", streamedVideo: "https://video.skin" },
      ],
    };
    expect(getSkinVideo(skin as any)).toBe("https://video.skin");
  });
});

describe("clearCache", () => {
  it("calls redis.del with all 4 KEYS values", async () => {
    await clearCache();

    expect(mockRedisDel).toHaveBeenCalledTimes(4);
    expect(mockRedisDel).toHaveBeenCalledWith("valorant:skins");
    expect(mockRedisDel).toHaveBeenCalledWith("valorant:tiers");
    expect(mockRedisDel).toHaveBeenCalledWith("valorant:bundles");
    expect(mockRedisDel).toHaveBeenCalledWith("valorant:competitive");
  });
});
