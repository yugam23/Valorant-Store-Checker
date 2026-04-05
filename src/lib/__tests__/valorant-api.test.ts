import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ValorantWeaponSkin } from "@/types/riot";

// ---------------------------------------------------------------------------
// Mock dependencies — all declared before any imports (vi.mock is hoisted)
// ---------------------------------------------------------------------------

const mockRedisGet = vi.fn();
const mockRedisSet = vi.fn();

vi.mock("@/lib/redis-client", () => ({
  redis: {
    get: (...args: unknown[]) => mockRedisGet(...args),
    set: (...args: unknown[]) => mockRedisSet(...args),
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
  getSkinLevelByUuid,
  getBuddyLevelByUuid,
  getSprayByUuid,
  _resetSkinsCache,
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
  vi.restoreAllMocks();
  // Default successful return values for set
  mockRedisSet.mockResolvedValue("OK");
  // Reset module-level skins cache so tests are isolated
  _resetSkinsCache();
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

describe("getSkinLevelByUuid", () => {
  it("cache hit: returns data without fetch", async () => {
    const levelData = { uuid: "level-1", displayName: "Level 1", levelItem: null, displayIcon: "icon.png", streamedVideo: null, assetPath: "asset" };
    mockRedisGet.mockResolvedValue(makeCachedPayload(levelData));

    const result = await getSkinLevelByUuid("level-1");

    expect(result).toEqual(levelData);
  });

  it("cache miss, fetch succeeds: stores in cache, returns data", async () => {
    const levelData = { uuid: "level-2", displayName: "Level 2", levelItem: null, displayIcon: "icon2.png", streamedVideo: null, assetPath: "asset2" };
    mockRedisGet.mockResolvedValue(null);
    vi.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ status: 200, data: levelData }),
    } as Response);

    const result = await getSkinLevelByUuid("level-2");

    expect(result).toEqual(levelData);
    expect(mockRedisSet).toHaveBeenCalled();
  });

  it("cache miss, fetch fails, stale cache exists: returns stale data", async () => {
    const levelData = { uuid: "level-3", displayName: "Level 3", levelItem: null, displayIcon: "icon3.png", streamedVideo: null, assetPath: "asset3" };
    mockRedisGet
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(makeCachedPayload(levelData));
    vi.spyOn(global, "fetch").mockRejectedValueOnce(new Error("Network failure"));

    const result = await getSkinLevelByUuid("level-3");

    expect(result).toEqual(levelData);
  });

  it("cache miss, fetch returns non-ok: returns null", async () => {
    mockRedisGet.mockResolvedValue(null);
    vi.spyOn(global, "fetch").mockResolvedValueOnce({ ok: false, status: 404 } as Response);

    const result = await getSkinLevelByUuid("level-404");

    expect(result).toBeNull();
  });

  it("cache miss, fetch returns non-200: returns null", async () => {
    mockRedisGet.mockResolvedValue(null);
    vi.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: true,
      status: 500,
      json: async () => ({ status: 500, data: null }),
    } as Response);

    const result = await getSkinLevelByUuid("level-500");

    expect(result).toBeNull();
  });

  it("cache miss, fetch returns null data: returns null", async () => {
    mockRedisGet.mockResolvedValue(null);
    vi.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ status: 200, data: null }),
    } as Response);

    const result = await getSkinLevelByUuid("level-null");

    expect(result).toBeNull();
  });
});

describe("getBuddyLevelByUuid", () => {
  it("cache hit: returns data without fetch", async () => {
    const buddyData = { uuid: "buddy-1", displayName: "Buddy 1", displayIcon: "buddy.png", assetPath: "buddy-asset" };
    mockRedisGet.mockResolvedValue(makeCachedPayload(buddyData));

    const result = await getBuddyLevelByUuid("buddy-1");

    expect(result).toEqual(buddyData);
  });

  it("cache miss, fetch succeeds: stores in cache, returns data", async () => {
    const buddyData = { uuid: "buddy-2", displayName: "Buddy 2", displayIcon: "buddy2.png", assetPath: "buddy-asset2" };
    mockRedisGet.mockResolvedValue(null);
    vi.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ status: 200, data: buddyData }),
    } as Response);

    const result = await getBuddyLevelByUuid("buddy-2");

    expect(result).toEqual(buddyData);
    expect(mockRedisSet).toHaveBeenCalled();
  });

  it("cache miss, fetch fails, stale cache exists: returns stale data", async () => {
    const buddyData = { uuid: "buddy-3", displayName: "Buddy 3", displayIcon: "buddy3.png", assetPath: "buddy-asset3" };
    mockRedisGet
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(makeCachedPayload(buddyData));
    vi.spyOn(global, "fetch").mockRejectedValueOnce(new Error("Network failure"));

    const result = await getBuddyLevelByUuid("buddy-3");

    expect(result).toEqual(buddyData);
  });

  it("cache miss, fetch returns non-ok: returns null", async () => {
    mockRedisGet.mockResolvedValue(null);
    vi.spyOn(global, "fetch").mockResolvedValueOnce({ ok: false, status: 404 } as Response);

    const result = await getBuddyLevelByUuid("buddy-404");

    expect(result).toBeNull();
  });

  it("cache miss, fetch returns non-200: returns null", async () => {
    mockRedisGet.mockResolvedValue(null);
    vi.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: true,
      status: 500,
      json: async () => ({ status: 500, data: null }),
    } as Response);

    const result = await getBuddyLevelByUuid("buddy-500");

    expect(result).toBeNull();
  });

  it("cache miss, fetch returns null data: returns null", async () => {
    mockRedisGet.mockResolvedValue(null);
    vi.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ status: 200, data: null }),
    } as Response);

    const result = await getBuddyLevelByUuid("buddy-null");

    expect(result).toBeNull();
  });
});

describe("getSprayByUuid", () => {
  it("cache hit: returns data without fetch", async () => {
    const sprayData = { uuid: "spray-1", displayName: "Spray 1", displayIcon: "spray.png", largeArt: "large.png", wideArt: "wide.png", assetPath: "spray-asset" };
    mockRedisGet.mockResolvedValue(makeCachedPayload(sprayData));

    const result = await getSprayByUuid("spray-1");

    expect(result).toEqual(sprayData);
  });

  it("cache miss, fetch succeeds: stores in cache, returns data", async () => {
    const sprayData = { uuid: "spray-2", displayName: "Spray 2", displayIcon: "spray2.png", largeArt: null, wideArt: null, assetPath: "spray-asset2" };
    mockRedisGet.mockResolvedValue(null);
    vi.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ status: 200, data: sprayData }),
    } as Response);

    const result = await getSprayByUuid("spray-2");

    expect(result).toEqual(sprayData);
    expect(mockRedisSet).toHaveBeenCalled();
  });

  it("cache miss, fetch fails, stale cache exists: returns stale data", async () => {
    const sprayData = { uuid: "spray-3", displayName: "Spray 3", displayIcon: "spray3.png", largeArt: null, wideArt: null, assetPath: "spray-asset3" };
    mockRedisGet
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(makeCachedPayload(sprayData));
    vi.spyOn(global, "fetch").mockRejectedValueOnce(new Error("Network failure"));

    const result = await getSprayByUuid("spray-3");

    expect(result).toEqual(sprayData);
  });

  it("cache miss, fetch returns non-ok: returns null", async () => {
    mockRedisGet.mockResolvedValue(null);
    vi.spyOn(global, "fetch").mockResolvedValueOnce({ ok: false, status: 404 } as Response);

    const result = await getSprayByUuid("spray-404");

    expect(result).toBeNull();
  });

  it("cache miss, fetch returns non-200: returns null", async () => {
    mockRedisGet.mockResolvedValue(null);
    vi.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: true,
      status: 500,
      json: async () => ({ status: 500, data: null }),
    } as Response);

    const result = await getSprayByUuid("spray-500");

    expect(result).toBeNull();
  });

  it("cache miss, fetch returns null data: returns null", async () => {
    mockRedisGet.mockResolvedValue(null);
    vi.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ status: 200, data: null }),
    } as Response);

    const result = await getSprayByUuid("spray-null");

    expect(result).toBeNull();
  });
});
