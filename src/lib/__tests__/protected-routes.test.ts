import { vi, describe, it, expect, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// ---------------------------------------------------------------------------
// Mocks — all declared before any imports (vi.mock is hoisted)
// ---------------------------------------------------------------------------

// Mock session module — both getSession and getSessionWithRefresh return null
// so that withSession HOF returns 401 Unauthorized for all requests
vi.mock("@/lib/session", () => ({
  getSession: vi.fn(async () => null),
  getSessionWithRefresh: vi.fn(async () => null),
}));

// Mock accounts module — used by accounts/switch route internally
vi.mock("@/lib/accounts", () => ({
  switchAccount: vi.fn(),
  getActiveAccount: vi.fn(),
}));

// Mock wishlist module — used by wishlist route
vi.mock("@/lib/wishlist", () => ({
  getWishlist: vi.fn(),
  addToWishlist: vi.fn(),
  removeFromWishlist: vi.fn(),
  isWishlisted: vi.fn(),
  checkWishlistInStore: vi.fn(),
}));

// Mock profile-cache module — used by profile route
vi.mock("@/lib/profile-cache", () => ({
  getProfileData: vi.fn(),
}));

// Mock riot-store — imported transitively by profile/route.ts for StoreTokens type
vi.mock("@/lib/riot-store", () => ({
  getRiotStore: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Dynamic imports AFTER mocks
// ---------------------------------------------------------------------------

const wishlistRoute = await import("@/app/api/wishlist/route");
const profileRoute = await import("@/app/api/profile/route");
const switchRoute = await import("@/app/api/accounts/switch/route");

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

function makeRequest(url: string, method = "GET", body?: unknown): NextRequest {
  const init: RequestInit = { method, headers: { "Content-Type": "application/json" } };
  if (body !== undefined) init.body = JSON.stringify(body);
  return new NextRequest(`http://localhost${url}`, init);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Protected routes — 401 when no session", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // -- Wishlist ---------------------------------------------------------------

  it("GET /api/wishlist returns 401 (no session)", async () => {
    const res = await wishlistRoute.GET(makeRequest("/api/wishlist"));
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe("Unauthorized");
  });

  it("POST /api/wishlist returns 401 (no session)", async () => {
    const res = await wishlistRoute.POST(makeRequest("/api/wishlist", "POST", {
      skinUuid: "test-uuid",
      displayName: "Test Skin",
      displayIcon: "https://example.com/icon.png",
      tierColor: "#ffffff",
    }));
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe("Unauthorized");
  });

  it("DELETE /api/wishlist returns 401 (no session)", async () => {
    const res = await wishlistRoute.DELETE(makeRequest("/api/wishlist", "DELETE", {
      skinUuid: "test-uuid",
    }));
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe("Unauthorized");
  });

  // -- Profile ----------------------------------------------------------------

  it("GET /api/profile returns 401 (no session)", async () => {
    const res = await profileRoute.GET(makeRequest("/api/profile"));
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe("Unauthorized");
  });

  // -- Accounts/Switch --------------------------------------------------------

  it("POST /api/accounts/switch returns 401 (no session)", async () => {
    const res = await switchRoute.POST(makeRequest("/api/accounts/switch", "POST", {
      puuid: "test-puuid-1234",
    }));
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe("Unauthorized");
  });
});
