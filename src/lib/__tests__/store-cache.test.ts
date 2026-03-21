import { describe, it, expect, vi, beforeEach } from "vitest";
import type { StoreData } from "@/types/store";

// ---------------------------------------------------------------------------
// Mocks — all declared before any imports (vi.mock is hoisted)
// ---------------------------------------------------------------------------

const mockRedisGet = vi.fn();
const mockRedisSet = vi.fn();
const mockRedisDel = vi.fn();
const mockRedisExists = vi.fn();
const mockRedisScan = vi.fn();

vi.mock("@/lib/redis-client", () => ({
  redis: {
    get: (...args: unknown[]) => mockRedisGet(...args),
    set: (...args: unknown[]) => mockRedisSet(...args),
    del: (...args: unknown[]) => mockRedisDel(...args),
    exists: (...args: unknown[]) => mockRedisExists(...args),
    scan: (...args: unknown[]) => mockRedisScan(...args),
  },
}));

// ---------------------------------------------------------------------------
// Import module under test AFTER mocks are declared
// ---------------------------------------------------------------------------

const { getCachedStore, setCachedStore, clearCachedStore } = await import(
  "@/lib/store-cache"
);

// ---------------------------------------------------------------------------
// Helper factories
// ---------------------------------------------------------------------------

function makeStoreData(overrides: Partial<StoreData> = {}): StoreData {
  return {
    items: [],
    expiresAt: new Date(Date.now() + 86400000), // 24h from now
    ...overrides,
  };
}

function makeCacheEntry(data: StoreData, cachedAt: number = Date.now() - 60000) {
  return JSON.stringify({ data, cachedAt });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
  mockRedisSet.mockResolvedValue("OK");
  mockRedisDel.mockResolvedValue(1);
  mockRedisExists.mockResolvedValue(0);
  mockRedisScan.mockResolvedValue(["0", []]);
});

describe("getCachedStore", () => {
  it("returns null on cache miss (redis.get returns null)", async () => {
    mockRedisGet.mockResolvedValue(null);

    const result = await getCachedStore("test-puuid");

    expect(result).toBeNull();
    expect(mockRedisGet).toHaveBeenCalledWith("store:test-puuid");
  });

  it("returns StoreData on cache hit with valid JSON", async () => {
    const storeData = makeStoreData();
    mockRedisGet.mockResolvedValue(makeCacheEntry(storeData));

    const result = await getCachedStore("test-puuid");

    // expiresAt is serialized to ISO string on JSON round-trip
    expect(result).toMatchObject({ items: [], expiresAt: storeData.expiresAt.toISOString() });
  });

  it("returns null and calls redis.del when JSON is malformed", async () => {
    mockRedisGet.mockResolvedValue("{invalid}");
    mockRedisDel.mockResolvedValue(1);

    const result = await getCachedStore("test-puuid");

    expect(result).toBeNull();
    expect(mockRedisDel).toHaveBeenCalledWith("store:test-puuid");
  });

  it("returns null and calls redis.del when cache entry is expired", async () => {
    const expiredStoreData = makeStoreData({
      expiresAt: new Date(Date.now() - 1000), // expired 1s ago
    });
    // cachedAt is old so the entry itself is stale
    mockRedisGet.mockResolvedValue(
      makeCacheEntry(expiredStoreData, Date.now() - 86400000)
    );
    mockRedisDel.mockResolvedValue(1);

    const result = await getCachedStore("test-puuid");

    expect(result).toBeNull();
    expect(mockRedisDel).toHaveBeenCalledWith("store:test-puuid");
  });
});

describe("setCachedStore", () => {
  it("new entry when cache not at capacity: calls redis.exists(0), redis.set with correct TTL", async () => {
    mockRedisExists.mockResolvedValue(0);
    mockRedisScan.mockResolvedValue(["0", []]); // cache size = 0

    const storeData = makeStoreData({
      expiresAt: new Date(Date.now() + 3600000), // 1h from now
    });

    await setCachedStore("test-puuid", storeData);

    expect(mockRedisExists).toHaveBeenCalledWith("store:test-puuid");
    // TTL should be positive (~3600s)
    expect(mockRedisSet).toHaveBeenCalled();
    const setCall = mockRedisSet.mock.calls[0];
    expect(setCall[0]).toBe("store:test-puuid");
    expect(setCall[2]).toHaveProperty("ex"); // TTL option present
  });

  it("new entry when cache is at MAX_CACHE_ENTRIES (10): calls evictOldestEntry before set", async () => {
    mockRedisExists.mockResolvedValue(0);
    // Sequence:
    // 1. getCacheSize calls scan once → gets 10 keys, cursor "0" → loop exits, returns 10
    // 2. evictOldestEntry calls scan once → cursor "0" → loop exits after first scan
    // 3. redis.del(puuid1) called
    // 4. redis.set for new entry
    mockRedisScan
      .mockResolvedValueOnce(["0", [
        "store:puuid1", "store:puuid2", "store:puuid3", "store:puuid4", "store:puuid5",
        "store:puuid6", "store:puuid7", "store:puuid8", "store:puuid9", "store:puuid10",
      ]])
      .mockResolvedValueOnce(["0", ["store:puuid1"]]); // evictOldestEntry only needs one scan

    // puuid1 is the oldest entry (oldest cachedAt)
    mockRedisGet.mockResolvedValue(
      makeCacheEntry(makeStoreData(), Date.now() - 86400000)
    );
    mockRedisDel.mockResolvedValue(1);

    const storeData = makeStoreData({
      expiresAt: new Date(Date.now() + 3600000),
    });

    await setCachedStore("new-puuid", storeData);

    // evictOldestEntry should have been called (redis.del on oldest)
    expect(mockRedisDel).toHaveBeenCalled();
    // set should still be called after eviction
    expect(mockRedisSet).toHaveBeenCalled();
  });

  it("existing entry: skips eviction check, directly calls redis.set", async () => {
    mockRedisExists.mockResolvedValue(1); // key already exists

    const storeData = makeStoreData({
      expiresAt: new Date(Date.now() + 3600000),
    });

    await setCachedStore("existing-puuid", storeData);

    expect(mockRedisExists).toHaveBeenCalledWith("store:existing-puuid");
    // getCacheSize should NOT be called because exists returned 1
    // (getCacheSize is only called when exists returns 0)
    // set should be called directly
    expect(mockRedisSet).toHaveBeenCalled();
  });

  it("TTL in past (expiresAt in past): calls redis.del instead of set", async () => {
    mockRedisExists.mockResolvedValue(0);
    mockRedisScan.mockResolvedValue(["0", []]);

    const storeData = makeStoreData({
      expiresAt: new Date(Date.now() - 1000), // expired 1s ago
    });

    await setCachedStore("expired-puuid", storeData);

    // del should be called, not set
    expect(mockRedisDel).toHaveBeenCalledWith("store:expired-puuid");
    expect(mockRedisSet).not.toHaveBeenCalled();
  });
});

describe("clearCachedStore", () => {
  it("calls redis.del with correct key 'store:{puuid}'", async () => {
    await clearCachedStore("my-puuid");

    expect(mockRedisDel).toHaveBeenCalledWith("store:my-puuid");
  });
});
