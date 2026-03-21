import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ---------------------------------------------------------------------------
// Mocks — all declared before any imports (vi.mock is hoisted)
// ---------------------------------------------------------------------------

vi.mock("@/lib/logger", () => ({
  createLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

vi.mock("@/lib/schemas/parse", () => ({
  parseWithLog: vi.fn((_schema, data) => data),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const MOCK_TOKENS = {
  accessToken: "test-access-token",
  entitlementsToken: "test-entitlements-token",
  puuid: "test-puuid-1234",
  region: "na",
};

const MOCK_VERSION = "10.02.3.1234";
const MOCK_MANIFEST_RESPONSE = {
  data: {
    manifests: {
      riotClientVersion: MOCK_VERSION,
    },
  },
};

const MOCK_STOREFRONT = { Storefront: { Skins: [] } };
const MOCK_WALLET = { Balances: { VP: 1000, RP: 500 } };

function makeOkResponse(data: unknown) {
  return {
    ok: true,
    status: 200,
    statusText: "OK",
    json: () => Promise.resolve(data),
    text: () => Promise.resolve(""),
  };
}

function makeFailResponse(status: number) {
  return {
    ok: false,
    status,
    statusText: "Service Unavailable",
    json: () => Promise.resolve({}),
    text: () => Promise.resolve(`HTTP ${status}`),
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("getStorefront — client version fetching", () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;
  let getStorefront: typeof import("@/lib/riot-store").getStorefront;

  beforeEach(async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    // Reset modules to get fresh module state with empty cache
    vi.resetModules();
    fetchSpy = vi.spyOn(globalThis, "fetch");

    // Re-import after reset to get fresh module
    const mod = await import("@/lib/riot-store");
    getStorefront = mod.getStorefront;
  });

  afterEach(() => {
    vi.useRealTimers();
    fetchSpy.mockRestore();
  });

  it("fetches client version from Riot manifest endpoint", async () => {
    fetchSpy.mockResolvedValue(makeOkResponse(MOCK_MANIFEST_RESPONSE));

    await getStorefront(MOCK_TOKENS);

    // Verify manifest endpoint was called
    const manifestCalls = fetchSpy.mock.calls.filter(
      (call) => (call[0] as string).includes("riotclient.riotgames.com")
    );
    expect(manifestCalls.length).toBeGreaterThan(0);
    expect(manifestCalls[0][0]).toBe(
      "https://riotclient.riotgames.com/riotclient/ux-middleware/bootstrap/manifest"
    );
  });

  it("throws error after 3 failed manifest fetch attempts (network error)", async () => {
    fetchSpy.mockRejectedValue(new Error("Network failure"));

    const result = getStorefront(MOCK_TOKENS).catch((e) => e);

    await vi.runAllTimersAsync();
    const error = await result;

    expect(error).toBeInstanceOf(Error);
    expect(error.message).toMatch(/Failed to fetch client version after 3 attempts/);
  });

  it("throws error on HTTP error responses after retries exhaust", async () => {
    fetchSpy.mockResolvedValue(makeFailResponse(503));

    const result = getStorefront(MOCK_TOKENS).catch((e) => e);

    await vi.runAllTimersAsync();
    const error = await result;

    expect(error).toBeInstanceOf(Error);
    expect(error.message).toMatch(/Failed to fetch client version after 3 attempts/);
  });

  it("uses cached version on subsequent calls within TTL", async () => {
    let manifestCallCount = 0;
    const realDateNow = Date.now.bind(globalThis.Date);
    const fakeTime = { current: realDateNow() };

    vi.spyOn(globalThis.Date, "now").mockImplementation(() => fakeTime.current);

    fetchSpy.mockImplementation((url: string) => {
      if ((url as string).includes("riotclient.riotgames.com")) {
        manifestCallCount++;
      }
      return Promise.resolve(makeOkResponse(MOCK_MANIFEST_RESPONSE));
    });

    // First call - populates cache (time = 0)
    await getStorefront(MOCK_TOKENS);
    expect(manifestCallCount).toBe(1); // 1 manifest fetch

    // Advance time by 30 minutes (stay within TTL of 1 hour)
    fakeTime.current += 30 * 60 * 1000;

    // Second call - should use cache, no new manifest fetch
    await getStorefront(MOCK_TOKENS);

    // Still 1 - no new manifest calls because cache is valid
    expect(manifestCallCount).toBe(1);

    vi.restoreAllMocks();
  });

  it("re-fetches manifest after cache TTL expires", async () => {
    let manifestCallCount = 0;
    fetchSpy.mockImplementation((url: string) => {
      if ((url as string).includes("riotclient.riotgames.com")) {
        manifestCallCount++;
      }
      return Promise.resolve(makeOkResponse(MOCK_MANIFEST_RESPONSE));
    });

    // First call - populates cache
    await getStorefront(MOCK_TOKENS);
    expect(manifestCallCount).toBe(1); // 1 manifest fetch

    // Advance time past TTL (1 hour)
    await vi.advanceTimersByTimeAsync(60 * 60 * 1000 + 1);
    vi.setSystemTime(Date.now() + 60 * 60 * 1000 + 1);

    // Second call - should re-fetch because cache expired
    await getStorefront(MOCK_TOKENS);

    expect(manifestCallCount).toBe(2); // New manifest fetch happened
  });
});

describe("getWallet — client version header inclusion", () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;
  let getWallet: typeof import("@/lib/riot-store").getWallet;

  beforeEach(async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.resetModules();
    fetchSpy = vi.spyOn(globalThis, "fetch");

    const mod = await import("@/lib/riot-store");
    getWallet = mod.getWallet;
  });

  afterEach(() => {
    vi.useRealTimers();
    fetchSpy.mockRestore();
  });

  it("fetches client version then wallet data", async () => {
    fetchSpy.mockImplementation((url: string) => {
      if ((url as string).includes("riotclient.riotgames.com")) {
        return Promise.resolve(makeOkResponse(MOCK_MANIFEST_RESPONSE));
      }
      if ((url as string).includes("/store/v1/wallet/")) {
        return Promise.resolve(makeOkResponse(MOCK_WALLET));
      }
      return Promise.resolve(makeOkResponse({}));
    });

    const result = await getWallet(MOCK_TOKENS);

    expect(result).toBeDefined();

    // Verify manifest endpoint was called first (for client version)
    const manifestCalls = fetchSpy.mock.calls.filter(
      (call) => (call[0] as string).includes("riotclient.riotgames.com")
    );
    expect(manifestCalls.length).toBeGreaterThan(0);
  });

  it("passes X-Riot-ClientVersion header with correct version", async () => {
    let capturedHeaders: Record<string, string> = {};

    fetchSpy.mockImplementation(async (url: string, init?: RequestInit) => {
      if ((url as string).includes("riotclient.riotgames.com")) {
        return Promise.resolve(makeOkResponse(MOCK_MANIFEST_RESPONSE));
      }
      if ((url as string).includes("/store/v1/wallet/")) {
        capturedHeaders = (init?.headers as Record<string, string>) || {};
        return Promise.resolve(makeOkResponse(MOCK_WALLET));
      }
      return Promise.resolve(makeOkResponse({}));
    });

    await getWallet(MOCK_TOKENS);

    // Verify the client version header was set correctly
    expect(capturedHeaders["X-Riot-ClientVersion"]).toBe(MOCK_VERSION);
  });
});
