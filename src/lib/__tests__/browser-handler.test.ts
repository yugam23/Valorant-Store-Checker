import { vi, describe, it, expect, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock("@/lib/browser-auth", () => ({
  launchBasicBrowser: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Dynamic import
// ---------------------------------------------------------------------------

const { handleBrowserAuth } = await import("@/lib/auth-handlers/browser");

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
});

describe("handleBrowserAuth", () => {
  it("launchBasicBrowser returns success -> 200 with success:true", async () => {
    const { launchBasicBrowser } = await import("@/lib/browser-auth");
    vi.mocked(launchBasicBrowser).mockResolvedValue({
      success: true,
    });

    const res = await handleBrowserAuth({
      type: "launch_browser",
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.message).toBe("Browser launched successfully");
  });

  it("launchBasicBrowser returns failure -> 500 with error message", async () => {
    const { launchBasicBrowser } = await import("@/lib/browser-auth");
    vi.mocked(launchBasicBrowser).mockResolvedValue({
      success: false,
      error: "browser_not_found",
    });

    const res = await handleBrowserAuth({
      type: "launch_browser",
    });

    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe("browser_not_found");
  });
});
