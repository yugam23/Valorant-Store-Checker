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
const mockPipeline = vi.fn(() => ({
  set: vi.fn().mockReturnThis(),
  zadd: vi.fn().mockReturnThis(),
  zremrangebyrank: vi.fn().mockReturnThis(),
  del: vi.fn().mockReturnThis(),
  zrem: vi.fn().mockReturnThis(),
  exec: vi.fn().mockResolvedValue([]),
}));

vi.mock("@/lib/redis-client", () => ({
  redis: {
    get: (...args: unknown[]) => mockRedisGet(...args),
    set: (...args: unknown[]) => mockRedisSet(...args),
    del: (...args: unknown[]) => mockRedisDel(...args),
    exists: (...args: unknown[]) => mockRedisExists(...args),
    scan: (...args: unknown[]) => mockRedisScan(...args),
    pipeline: mockPipeline,
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

  it("returns null and does not throw when redis.get rejects with timeout error", async () => {
    mockRedisGet.mockRejectedValue(new Error("Redis timeout exceeded"));

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
  it("new entry: calls pipeline with set, zadd, zremrangebyrank, and exec", async () => {
    const storeData = makeStoreData({
      expiresAt: new Date(Date.now() + 3600000), // 1h from now
    });

    await setCachedStore("test-puuid", storeData);

    expect(mockPipeline).toHaveBeenCalled();
    const pipe = mockPipeline.mock.results[0].value;
    expect(pipe.set).toHaveBeenCalledWith(
      "store:test-puuid",
      expect.any(String),
      { ex: expect.any(Number) }
    );
    expect(pipe.zadd).toHaveBeenCalledWith("store:order", {
      score: expect.any(Number),
      member: "test-puuid",
    });
    expect(pipe.zremrangebyrank).toHaveBeenCalledWith("store:order", 0, -11);
    expect(pipe.exec).toHaveBeenCalled();
  });

  it("new entry when cache is at MAX_CACHE_ENTRIES (10): eviction happens via zremrangebyrank", async () => {
    const storeData = makeStoreData({
      expiresAt: new Date(Date.now() + 3600000),
    });

    await setCachedStore("new-puuid", storeData);

    // zremrangebyrank trims to newest 10 entries
    const pipe = mockPipeline.mock.results[0].value;
    expect(pipe.zremrangebyrank).toHaveBeenCalledWith("store:order", 0, -11);
    expect(pipe.set).toHaveBeenCalled();
  });

  it("existing entry: still uses pipeline (no exists check needed)", async () => {
    const storeData = makeStoreData({
      expiresAt: new Date(Date.now() + 3600000),
    });

    await setCachedStore("existing-puuid", storeData);

    expect(mockPipeline).toHaveBeenCalled();
    const pipe = mockPipeline.mock.results[0].value;
    expect(pipe.set).toHaveBeenCalled();
  });

  it("TTL in past (expiresAt in past): calls redis.del instead of pipeline", async () => {
    const storeData = makeStoreData({
      expiresAt: new Date(Date.now() - 1000), // expired 1s ago
    });

    await setCachedStore("expired-puuid", storeData);

    expect(mockRedisDel).toHaveBeenCalledWith("store:expired-puuid");
    expect(mockPipeline).not.toHaveBeenCalled();
  });
});

describe("clearCachedStore", () => {
  it("calls pipeline with del, zrem, and exec", async () => {
    await clearCachedStore("my-puuid");

    expect(mockPipeline).toHaveBeenCalled();
    const pipe = mockPipeline.mock.results[0].value;
    expect(pipe.del).toHaveBeenCalledWith("store:my-puuid");
    expect(pipe.zrem).toHaveBeenCalledWith("store:order", "my-puuid");
    expect(pipe.exec).toHaveBeenCalled();
  });
});
