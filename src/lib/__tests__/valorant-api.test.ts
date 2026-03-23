import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ValorantWeaponSkin } from "@/types/riot";

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
  {
    uuid: "skin-1",
    displayName: "Vandal",
    themeUuid: "theme-1",
    contentTierUuid: null,
    displayIcon: "icon.png",
    wallpaper: null,
    assetPath: "Skins/Skin-1",
    levels: [
      {
        uuid: "level-1",
        displayName: "Vandal Standard",
        levelItem: null,
        displayIcon: "level-icon.png",
        streamedVideo: null,
        assetPath: "Levels/Level-1",
      },
    ],
    chromas: [
      {
        uuid: "chroma-1",
        displayName: "Vandal Red",
        displayIcon: "chroma-icon.png",
        fullRender: "full-render.png",
        swatch: "swatch.png",
        streamedVideo: null,
        assetPath: "Chromas/Chroma-1",
      },
    ],
  },
];
const MOCK_TIERS_DATA = [
  {
    uuid: "tier-1",
    displayName: "Select",
    devName: "Select",
    rank: 1,
    juiceValue: 0,
    juiceCost: 0,
    highlightColor: "#ffffff",
    displayIcon: "tier-icon.png",
    assetPath: "Tiers/Tier-1",
  },
];
const MOCK_BUNDLES_DATA = [
  {
    uuid: "bundle-1",
    displayName: "Premium Bundle",
    displayNameSubText: null,
    description: null,
    extraDescription: null,
    promoDescription: null,
    useAdditionalContext: false,
    displayIcon: "bundle.png",
    displayIcon2: "bundle2.png",
    verticalPromoImage: null,
    assetPath: "Bundles/Bundle-1",
  },
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

function makeCachedPayload<T>(data: T, timestamp?: number) {
  return JSON.stringify({ data, timestamp: timestamp ?? Date.now() - 3600000 });
}

function makeValidApiResponse(data: unknown, status = 200) {
  return { status, data };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  // Reset ALL mock functions completely to clear implementations AND call history
  mockRedisGet.mockReset();
  mockRedisSet.mockReset();
  mockRedisDel.mockReset();
  vi.restoreAllMocks();
  // Default successful return values for set/del
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
      .mockResolvedValueOnce(null) // getCache fresh check
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

  it("cache hit but expired (>24h old): fetches fresh data instead of returning stale", async () => {
    // Cache timestamp > 24 hours ago → TTL expired, getCache returns null
    const oldTimestamp = Date.now() - 25 * 60 * 60 * 1000;
    mockRedisGet.mockResolvedValue(makeCachedPayload(MOCK_SKINS_DATA, oldTimestamp));
    vi.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => makeValidApiResponse(MOCK_SKINS_DATA),
    } as Response);

    const result = await getWeaponSkins();

    expect(result).toEqual(MOCK_SKINS_DATA);
    expect(mockRedisSet).toHaveBeenCalled();
  });

  it("stale cache with malformed JSON: getStaleCache catch block returns null, rethrows", async () => {
    mockRedisGet
      .mockResolvedValueOnce(null) // getCache fresh check
      .mockResolvedValueOnce("{invalid-json"); // getStaleCache → JSON.parse throws
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
    expect(getSkinVideo(skin as unknown as ValorantWeaponSkin)).toBeNull();
  });

  it("levels exist but no streamedVideo: returns null", () => {
    const skin = { uuid: "skin-1", levels: [{ uuid: "l1", streamedVideo: null }, { uuid: "l2", streamedVideo: "" }] };
    expect(getSkinVideo(skin as unknown as ValorantWeaponSkin)).toBeNull();
  });

  it("levels with streamedVideo: returns the video URL", () => {
    const skin = {
      uuid: "skin-1",
      levels: [
        { uuid: "l1", streamedVideo: null },
        { uuid: "l2", streamedVideo: "" },
        { vnd: "l3", streamedVideo: "https://video.skin" },
      ],
    };
    expect(getSkinVideo(skin as unknown as ValorantWeaponSkin)).toBe("https://video.skin");
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

describe("getCacheStatus", () => {
  it("returns cached:true with count and age for all three cached items", async () => {
    const ts = Date.now() - 3600000;
    mockRedisGet
      .mockResolvedValueOnce(makeCachedPayload(MOCK_SKINS_DATA, ts))
      .mockResolvedValueOnce(makeCachedPayload(MOCK_TIERS_DATA, ts))
      .mockResolvedValueOnce(makeCachedPayload(MOCK_BUNDLES_DATA, ts));

    const { getCacheStatus } = await import("@/lib/valorant-api");
    const result = await getCacheStatus();

    expect(result.weaponSkins.cached).toBe(true);
    expect(result.weaponSkins.count).toBe(MOCK_SKINS_DATA.length);
    expect(result.weaponSkins.valid).toBe(true);
    expect(result.contentTiers.cached).toBe(true);
    expect(result.bundles.cached).toBe(true);
  });

  it("returns cached:false with nulls for uncached items", async () => {
    mockRedisGet
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null);

    const { getCacheStatus } = await import("@/lib/valorant-api");
    const result = await getCacheStatus();

    expect(result.weaponSkins.cached).toBe(false);
    expect(result.weaponSkins.count).toBeNull();
    expect(result.weaponSkins.age).toBeNull();
    expect(result.weaponSkins.valid).toBe(false);
  });
});

describe("getWeaponSkinByUuid", () => {
  it("returns skin when found in cached data", async () => {
    const skins = [
      { uuid: "skin-abc", displayName: "Vandal", displayIcon: "icon.png", levels: [], chromas: [], contentTierUuid: null },
    ];
    mockRedisGet.mockResolvedValue(makeCachedPayload(skins));

    const { getWeaponSkinByUuid } = await import("@/lib/valorant-api");
    const result = await getWeaponSkinByUuid("skin-abc");

    expect(result).not.toBeNull();
    expect(result!.displayName).toBe("Vandal");
  });

  it("returns null when skin not found", async () => {
    const skins = [{ uuid: "skin-xyz", displayName: "Phantom", displayIcon: "icon.png", levels: [], chromas: [], contentTierUuid: null }];
    mockRedisGet.mockResolvedValue(makeCachedPayload(skins));

    const { getWeaponSkinByUuid } = await import("@/lib/valorant-api");
    const result = await getWeaponSkinByUuid("not-found");

    expect(result).toBeNull();
  });
});

describe("getContentTierByUuid", () => {
  it("returns tier when found", async () => {
    mockRedisGet.mockResolvedValue(makeCachedPayload(MOCK_TIERS_DATA));

    const { getContentTierByUuid } = await import("@/lib/valorant-api");
    const result = await getContentTierByUuid("tier-1");

    expect(result).not.toBeNull();
    expect(result!.displayName).toBe("Select");
  });

  it("returns null when tier not found", async () => {
    mockRedisGet.mockResolvedValue(makeCachedPayload(MOCK_TIERS_DATA));

    const { getContentTierByUuid } = await import("@/lib/valorant-api");
    const result = await getContentTierByUuid("not-found");

    expect(result).toBeNull();
  });
});

describe("getBundleByUuid", () => {
  it("returns bundle when found", async () => {
    mockRedisGet.mockResolvedValue(makeCachedPayload(MOCK_BUNDLES_DATA));

    const { getBundleByUuid } = await import("@/lib/valorant-api");
    const result = await getBundleByUuid("bundle-1");

    expect(result).not.toBeNull();
    expect(result!.displayName).toBe("Premium Bundle");
  });

  it("returns null when bundle not found", async () => {
    mockRedisGet.mockResolvedValue(makeCachedPayload(MOCK_BUNDLES_DATA));

    const { getBundleByUuid } = await import("@/lib/valorant-api");
    const result = await getBundleByUuid("not-found");

    expect(result).toBeNull();
  });
});

describe("getWeaponSkinsByUuids", () => {
  it("returns Map of matching skins by skin UUID", async () => {
    const skins = [
      { uuid: "skin-a", displayName: "Vandal", displayIcon: "v.png", levels: [], chromas: [], contentTierUuid: null },
      { uuid: "skin-b", displayName: "Phantom", displayIcon: "p.png", levels: [], chromas: [], contentTierUuid: null },
    ];
    mockRedisGet.mockResolvedValue(makeCachedPayload(skins));

    const { getWeaponSkinsByUuids } = await import("@/lib/valorant-api");
    const result = await getWeaponSkinsByUuids(["skin-a", "skin-c"]);

    expect(result.size).toBe(1);
    expect(result.get("skin-a")!.displayName).toBe("Vandal");
  });

  it("case-insensitive UUID matching", async () => {
    const skins = [
      { uuid: "SKIN-A", displayName: "Vandal", displayIcon: "v.png", levels: [], chromas: [], contentTierUuid: null },
    ];
    mockRedisGet.mockResolvedValue(makeCachedPayload(skins));

    const { getWeaponSkinsByUuids } = await import("@/lib/valorant-api");
    const result = await getWeaponSkinsByUuids(["skin-a"]);

    expect(result.size).toBe(1);
  });
});

describe("getWeaponSkinsByLevelUuids", () => {
  it("returns Map of matching skins by level UUID", async () => {
    const skins = [
      {
        uuid: "skin-1",
        displayName: "Vandal",
        displayIcon: "v.png",
        levels: [
          { uuid: "level-1a", streamedVideo: "vid.mp4" },
          { uuid: "level-1b", streamedVideo: null },
        ],
        chromas: [],
        contentTierUuid: null,
      },
    ];
    mockRedisGet.mockResolvedValue(makeCachedPayload(skins));

    const { getWeaponSkinsByLevelUuids } = await import("@/lib/valorant-api");
    const result = await getWeaponSkinsByLevelUuids(["level-1a"]);

    expect(result.size).toBe(1);
    expect(result.get("level-1a")!.displayName).toBe("Vandal");
  });

  it("matches parent skin UUID as well as level UUID", async () => {
    const skins = [
      {
        uuid: "skin-parent",
        displayName: "Vandal",
        displayIcon: "v.png",
        levels: [],
        chromas: [],
        contentTierUuid: null,
      },
    ];
    mockRedisGet.mockResolvedValue(makeCachedPayload(skins));

    const { getWeaponSkinsByLevelUuids } = await import("@/lib/valorant-api");
    const result = await getWeaponSkinsByLevelUuids(["skin-parent"]);

    expect(result.size).toBe(1);
    expect(result.get("skin-parent")!.displayName).toBe("Vandal");
  });
});
