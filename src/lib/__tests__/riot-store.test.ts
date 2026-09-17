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
const MOCK_VERSION_RESPONSE = {
  status: 200,
  data: {
    riotClientVersion: MOCK_VERSION,
  },
};

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

  it("fetches client version from valorant-api.com", async () => {
    fetchSpy.mockResolvedValue(makeOkResponse(MOCK_VERSION_RESPONSE));

    await getStorefront(MOCK_TOKENS);

    const urls = fetchSpy.mock.calls.map((call: unknown[]) => call[0] as string);
    expect(urls[0]).toBe("https://valorant-api.com/v1/version");
    // riotclient.riotgames.com no longer resolves — it must never be called
    expect(urls.some((url: string) => url.includes("riotclient.riotgames.com"))).toBe(false);
  });

  it("throws error when the version fetch fails (network error)", async () => {
    fetchSpy.mockRejectedValue(new Error("Network failure"));

    const result = getStorefront(MOCK_TOKENS).catch((e) => e);

    await vi.runAllTimersAsync();
    const error = await result;

    expect(error).toBeInstanceOf(Error);
    expect(error.message).toMatch(/Failed to fetch client version/);
  });

  it("throws error on HTTP error responses", async () => {
    fetchSpy.mockImplementation((url: string) => {
      if (url.includes("valorant-api.com")) {
        return Promise.resolve(makeFailResponse(503));
      }
      return Promise.resolve(makeOkResponse({}));
    });

    const result = getStorefront(MOCK_TOKENS).catch((e) => e);

    await vi.runAllTimersAsync();
    const error = await result;

    expect(error).toBeInstanceOf(Error);
    expect(error.message).toMatch(/Failed to fetch client version/);
  });

  it("uses cached version on subsequent calls within TTL", async () => {
    let manifestCallCount = 0;
    const realDateNow = Date.now.bind(globalThis.Date);
    const fakeTime = { current: realDateNow() };

    vi.spyOn(globalThis.Date, "now").mockImplementation(() => fakeTime.current);

    fetchSpy.mockImplementation((url: string) => {
      if ((url as string).includes("valorant-api.com/v1/version")) {
        manifestCallCount++;
      }
      return Promise.resolve(makeOkResponse(MOCK_VERSION_RESPONSE));
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
      if ((url as string).includes("valorant-api.com/v1/version")) {
        manifestCallCount++;
      }
      return Promise.resolve(makeOkResponse(MOCK_VERSION_RESPONSE));
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
      if ((url as string).includes("valorant-api.com/v1/version")) {
        return Promise.resolve(makeOkResponse(MOCK_VERSION_RESPONSE));
      }
      if ((url as string).includes("/store/v1/wallet/")) {
        return Promise.resolve(makeOkResponse(MOCK_WALLET));
      }
      return Promise.resolve(makeOkResponse({}));
    });

    const result = await getWallet(MOCK_TOKENS);

    expect(result).toBeDefined();

    // Verify version endpoint was called first (for client version)
    const manifestCalls = fetchSpy.mock.calls.filter(
      (call: unknown[]) => (call[0] as string).includes("valorant-api.com/v1/version")
    );
    expect(manifestCalls.length).toBeGreaterThan(0);
  });

  it("passes X-Riot-ClientVersion header with correct version", async () => {
    let capturedHeaders: Record<string, string> = {};

    fetchSpy.mockImplementation(async (url: string, init?: RequestInit) => {
      if ((url as string).includes("valorant-api.com/v1/version")) {
        return Promise.resolve(makeOkResponse(MOCK_VERSION_RESPONSE));
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

describe("fetchWithShardFallback — HTTP method selection", () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;
  let fetchWithShardFallback: typeof import("@/lib/riot-store").fetchWithShardFallback;

  beforeEach(async () => {
    vi.resetModules();
    fetchSpy = vi.spyOn(globalThis, "fetch");
    fetchSpy.mockResolvedValue(makeOkResponse(MOCK_VERSION_RESPONSE));

    const mod = await import("@/lib/riot-store");
    fetchWithShardFallback = mod.fetchWithShardFallback;
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  function methodFor(fragment: string): string | undefined {
    const call = fetchSpy.mock.calls.find((c: unknown[]) => (c[0] as string).includes(fragment));
    return (call?.[1] as RequestInit | undefined)?.method;
  }

  it("uses POST for the v3 storefront", async () => {
    await fetchWithShardFallback(MOCK_TOKENS, (pdUrl) => `${pdUrl}/store/v3/storefront/${MOCK_TOKENS.puuid}`);
    expect(methodFor("/store/v3/storefront/")).toBe("POST");
  });

  it("uses GET for other v3 endpoints like the player loadout", async () => {
    await fetchWithShardFallback(
      MOCK_TOKENS,
      (pdUrl) => `${pdUrl}/personalization/v3/players/${MOCK_TOKENS.puuid}/playerloadout`,
    );
    expect(methodFor("/personalization/v3/")).toBe("GET");
  });
});

describe("fetchWithShardFallback — shard selection", () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;
  let fetchWithShardFallback: typeof import("@/lib/riot-store").fetchWithShardFallback;

  const walletUrl = (pdUrl: string) => `${pdUrl}/store/v1/wallet/${MOCK_TOKENS.puuid}`;

  /** Mocks fetch so only the given PD hosts succeed; everything else on pvp.net 404s. */
  function mockShards(okHosts: string[]) {
    fetchSpy.mockImplementation((url: string) => {
      if (url.includes("valorant-api.com")) return Promise.resolve(makeOkResponse(MOCK_VERSION_RESPONSE));
      const host = new URL(url).host;
      return Promise.resolve(okHosts.includes(host) ? makeOkResponse(MOCK_WALLET) : makeFailResponse(404));
    });
  }

  function pdHostsCalled(): string[] {
    return fetchSpy.mock.calls
      .map((c: unknown[]) => c[0] as string)
      .filter((url: string) => url.includes(".a.pvp.net"))
      .map((url: string) => new URL(url).host);
  }

  beforeEach(async () => {
    vi.resetModules();
    fetchSpy = vi.spyOn(globalThis, "fetch");
    const mod = await import("@/lib/riot-store");
    fetchWithShardFallback = mod.fetchWithShardFallback;
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  it("calls only the session region's shard when it succeeds", async () => {
    mockShards(["pd.na.a.pvp.net"]);

    const response = await fetchWithShardFallback({ ...MOCK_TOKENS, region: "na" }, walletUrl);

    expect(response.ok).toBe(true);
    expect(pdHostsCalled()).toEqual(["pd.na.a.pvp.net"]);
  });

  it("remembers the shard even when it matches the session region", async () => {
    mockShards(["pd.na.a.pvp.net"]);
    const tokens = { ...MOCK_TOKENS, region: "am" }; // affinity "am" maps to the NA PD host

    await fetchWithShardFallback(tokens, walletUrl);
    fetchSpy.mockClear();
    await fetchWithShardFallback(tokens, walletUrl);

    expect(pdHostsCalled()).toEqual(["pd.na.a.pvp.net"]);
  });

  it("probes other shards only when the session region fails, then remembers the winner", async () => {
    mockShards(["pd.eu.a.pvp.net"]);
    const tokens = { ...MOCK_TOKENS, region: "na" };

    const first = await fetchWithShardFallback(tokens, walletUrl);
    expect(first.ok).toBe(true);
    expect(pdHostsCalled()[0]).toBe("pd.na.a.pvp.net");
    expect(pdHostsCalled()).toContain("pd.eu.a.pvp.net");

    fetchSpy.mockClear();
    await fetchWithShardFallback(tokens, walletUrl);
    expect(pdHostsCalled()).toEqual(["pd.eu.a.pvp.net"]);
  });

  it("never calls the same PD host twice in one lookup", async () => {
    mockShards([]); // every shard fails

    await fetchWithShardFallback({ ...MOCK_TOKENS, region: "am" }, walletUrl).catch(() => {});

    const hosts = pdHostsCalled();
    expect(hosts.length).toBe(new Set(hosts).size);
  });
});
