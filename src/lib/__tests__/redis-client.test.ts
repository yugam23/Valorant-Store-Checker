import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ---------------------------------------------------------------------------
// Mocks — all declared before any imports (vi.mock is hoisted)
// ---------------------------------------------------------------------------

const mockRedisCtor = vi.fn();

vi.mock("@upstash/redis", () => ({
  Redis: class {
    constructor(opts: unknown) {
      mockRedisCtor(opts);
    }
  },
}));

const ENV_KEYS = [
  "UPSTASH_REDIS_REST_URL",
  "UPSTASH_REDIS_REST_TOKEN",
  "KV_REST_API_URL",
  "KV_REST_API_TOKEN",
] as const;

async function loadRedis() {
  vi.resetModules();
  global.__redis = undefined;
  return (await import("@/lib/redis-client")).redis;
}

describe("redis-client", () => {
  beforeEach(() => {
    mockRedisCtor.mockClear();
    for (const key of ENV_KEYS) vi.stubEnv(key, "");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    global.__redis = undefined;
  });

  it("uses UPSTASH_REDIS_REST_* when set", async () => {
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://upstash.example");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "upstash-token");

    expect(await loadRedis()).not.toBeNull();
    expect(mockRedisCtor).toHaveBeenCalledWith(
      expect.objectContaining({ url: "https://upstash.example", token: "upstash-token" }),
    );
  });

  it("falls back to KV_REST_API_* (Vercel Marketplace Upstash integration)", async () => {
    vi.stubEnv("KV_REST_API_URL", "https://kv.example");
    vi.stubEnv("KV_REST_API_TOKEN", "kv-token");

    expect(await loadRedis()).not.toBeNull();
    expect(mockRedisCtor).toHaveBeenCalledWith(
      expect.objectContaining({ url: "https://kv.example", token: "kv-token" }),
    );
  });

  it("prefers UPSTASH_REDIS_REST_* over KV_REST_API_*", async () => {
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://upstash.example");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "upstash-token");
    vi.stubEnv("KV_REST_API_URL", "https://kv.example");
    vi.stubEnv("KV_REST_API_TOKEN", "kv-token");

    await loadRedis();
    expect(mockRedisCtor).toHaveBeenCalledWith(
      expect.objectContaining({ url: "https://upstash.example", token: "upstash-token" }),
    );
  });

  it("is disabled when neither pair is set", async () => {
    expect(await loadRedis()).toBeNull();
    expect(mockRedisCtor).not.toHaveBeenCalled();
  });
});
