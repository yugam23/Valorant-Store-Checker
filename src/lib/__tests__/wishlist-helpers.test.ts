import { vi, describe, it, expect, beforeEach } from "vitest";
import { createClient, type Client } from "@libsql/client";
import type { WishlistItem } from "@/types/wishlist";

// ---------------------------------------------------------------------------
// Module-level mock state - declared outside describe blocks
// ---------------------------------------------------------------------------

let testClient: Client;

const mockCookiesGet = vi.fn();
const mockCookiesSet = vi.fn();
const mockCookiesDelete = vi.fn();
const mockGetCurrentSessionId = vi.fn();
const mockInitSessionDb = vi.fn();

// ---------------------------------------------------------------------------
// Mock: @/lib/session-db (in-memory SQLite)
// ---------------------------------------------------------------------------

vi.mock("@/lib/session-db", () => ({
  initSessionDb: (...args: unknown[]) => mockInitSessionDb(...args),
}));

// ---------------------------------------------------------------------------
// Mock: @/lib/session
// ---------------------------------------------------------------------------

vi.mock("@/lib/session", () => ({
  getCurrentSessionId: (...args: unknown[]) => mockGetCurrentSessionId(...args),
}));

// ---------------------------------------------------------------------------
// Mock: next/headers
// ---------------------------------------------------------------------------

vi.mock("next/headers", () => ({
  cookies: vi.fn(() => ({
    get: mockCookiesGet,
    set: mockCookiesSet,
    delete: mockCookiesDelete,
  })),
}));

// ---------------------------------------------------------------------------
// Import module under test AFTER all mocks are declared
// ---------------------------------------------------------------------------

const { getWishlist, addToWishlist, removeFromWishlist } = await import("@/lib/wishlist");

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeWishlistItem(overrides: Partial<WishlistItem> = {}): WishlistItem {
  const id = Math.random().toString(36).slice(2, 10);
  return {
    skinUuid: `skin-uuid-${id}`,
    displayName: `Test Skin ${id}`,
    displayIcon: `https://example.com/icon-${id}.png`,
    tierColor: "#FFFFFF",
    addedAt: new Date().toISOString(),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// beforeEach: fresh in-memory SQLite + mock reset
// ---------------------------------------------------------------------------

beforeEach(async () => {
  // Create fresh in-memory SQLite per test
  testClient = createClient({ url: ":memory:" });
  await testClient.execute(
    "CREATE TABLE IF NOT EXISTS wishlists (session_id TEXT, puuid TEXT, skins TEXT, PRIMARY KEY (session_id, puuid))",
  );

  // CRITICAL: Use mockReset() NOT mockClear() to reset implementation
  mockCookiesGet.mockReset();
  mockCookiesSet.mockReset();
  mockCookiesDelete.mockReset();
  mockGetCurrentSessionId.mockReset();
  mockInitSessionDb.mockReset();

  // Default resolved values
  mockGetCurrentSessionId.mockResolvedValue("test-session-id");
  mockInitSessionDb.mockResolvedValue(testClient);
  mockCookiesGet.mockReturnValue(undefined);
});

// ---------------------------------------------------------------------------
// Tests: readWishlistItems() via getWishlist()
// ---------------------------------------------------------------------------

describe("readWishlistItems() - SQLite read path", () => {
  it("returns items from SQLite when available", async () => {
    const items = [makeWishlistItem(), makeWishlistItem()];
    const puuid = "test-puuid-123";

    // Mock SQLite returning rows
    await testClient.execute({
      sql: "INSERT INTO wishlists (session_id, puuid, skins) VALUES (?, ?, ?)",
      args: ["test-session-id", puuid, JSON.stringify(items)],
    });

    const result = await getWishlist(puuid);

    expect(result.items).toHaveLength(2);
    expect(result.count).toBe(2);
    expect(mockCookiesGet).not.toHaveBeenCalled();
  });

  it("returns empty array when sessionId is null", async () => {
    mockGetCurrentSessionId.mockResolvedValue(null);
    const puuid = "test-puuid-123";

    const result = await getWishlist(puuid);

    expect(result.items).toHaveLength(0);
    expect(result.count).toBe(0);
  });

  it("returns empty array when SQLite returns no rows and no cookie exists", async () => {
    // SQLite returns empty (testClient is fresh in-memory with no data)
    mockCookiesGet.mockReturnValue(undefined);
    const puuid = "test-puuid-123";

    const result = await getWishlist(puuid);

    expect(result.items).toHaveLength(0);
    expect(result.count).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Tests: readWishlistItems() - cookie fallback and migration
// ---------------------------------------------------------------------------

describe("readWishlistItems() - cookie fallback and migration", () => {
  it("falls back to cookie when SQLite returns empty", async () => {
    const items = [makeWishlistItem(), makeWishlistItem()];
    const puuid = "test-puuid-456";
    const cookieName = `valorant_wishlist_${puuid.substring(0, 8)}`;

    // SQLite returns empty (fresh in-memory)
    mockCookiesGet.mockReturnValue({ value: JSON.stringify(items) });

    const result = await getWishlist(puuid);

    expect(result.items).toHaveLength(2);
    expect(result.count).toBe(2);
    // Verify items were migrated to SQLite
    const sqliteResult = await testClient.execute({
      sql: "SELECT skins FROM wishlists WHERE session_id = ? AND puuid = ?",
      args: ["test-session-id", puuid],
    });
    expect(sqliteResult.rows.length).toBe(1);
  });

  it("returns empty array when both SQLite and cookie fail", async () => {
    // SQLite returns empty (fresh in-memory)
    mockCookiesGet.mockReturnValue(undefined);
    const puuid = "test-puuid-789";

    const result = await getWishlist(puuid);

    expect(result.items).toHaveLength(0);
    expect(result.count).toBe(0);
  });

  it("migrates cookie to SQLite atomically and deletes cookie after successful write", async () => {
    const items = [makeWishlistItem()];
    const puuid = "test-puuid-migrate";
    const cookieName = `valorant_wishlist_${puuid.substring(0, 8)}`;

    mockCookiesGet.mockReturnValue({ value: JSON.stringify(items) });

    await getWishlist(puuid);

    // Verify SQLite INSERT was called (migration happened)
    const sqliteResult = await testClient.execute({
      sql: "SELECT skins FROM wishlists WHERE session_id = ? AND puuid = ?",
      args: ["test-session-id", puuid],
    });
    expect(sqliteResult.rows.length).toBe(1);

    // Verify cookie was deleted ONLY after successful migration
    expect(mockCookiesDelete).toHaveBeenCalledWith(cookieName);
  });

  it("does not delete cookie if SQLite write fails during migration", async () => {
    // Set up a mock that makes SQLite write fail
    mockInitSessionDb.mockResolvedValue({
      execute: vi.fn().mockRejectedValue(new Error("SQLite write error")),
    } as unknown as Client);

    const items = [makeWishlistItem()];
    const puuid = "test-puuid-fail";

    mockCookiesGet.mockReturnValue({ value: JSON.stringify(items) });

    // Should still return items (fail-silent UX) but cookie should NOT be deleted
    const result = await getWishlist(puuid);

    // Error is caught internally, returns empty array
    expect(result.items).toHaveLength(0);
    expect(mockCookiesDelete).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Tests: addToWishlist() uses readWishlistItems()
// ---------------------------------------------------------------------------

describe("addToWishlist()", () => {
  it("adds item to wishlist retrieved via readWishlistItems()", async () => {
    const puuid = "test-puuid-add";
    const existingItems = [makeWishlistItem()];
    const newItem = makeWishlistItem({ skinUuid: "new-skin-uuid" });

    // Pre-populate SQLite
    await testClient.execute({
      sql: "INSERT INTO wishlists (session_id, puuid, skins) VALUES (?, ?, ?)",
      args: ["test-session-id", puuid, JSON.stringify(existingItems)],
    });

    const result = await addToWishlist(puuid, newItem);

    expect(result.items[0]).toMatchObject({ skinUuid: newItem.skinUuid });
    expect(result.count).toBe(2);
  });

  it("does not duplicate when item already exists", async () => {
    const puuid = "test-puuid-dup";
    const existingItem = makeWishlistItem({ skinUuid: "duplicate-skin" });

    // Pre-populate SQLite
    await testClient.execute({
      sql: "INSERT INTO wishlists (session_id, puuid, skins) VALUES (?, ?, ?)",
      args: ["test-session-id", puuid, JSON.stringify([existingItem])],
    });

    const result = await addToWishlist(puuid, existingItem);

    // Should still return 1 item (not duplicated)
    expect(result.items).toHaveLength(1);
    expect(result.count).toBe(1);
  });

  it("handles adding to empty wishlist", async () => {
    const puuid = "test-puuid-empty";
    const newItem = makeWishlistItem();

    const result = await addToWishlist(puuid, newItem);

    expect(result.items).toHaveLength(1);
    expect(result.count).toBe(1);
    expect(result.items[0].skinUuid).toBe(newItem.skinUuid);
  });
});

// ---------------------------------------------------------------------------
// Tests: removeFromWishlist() uses readWishlistItems()
// ---------------------------------------------------------------------------

describe("removeFromWishlist()", () => {
  it("removes item from wishlist retrieved via readWishlistItems()", async () => {
    const puuid = "test-puuid-remove";
    const items = [
      makeWishlistItem({ skinUuid: "remove-me" }),
      makeWishlistItem({ skinUuid: "keep-me" }),
    ];

    // Pre-populate SQLite
    await testClient.execute({
      sql: "INSERT INTO wishlists (session_id, puuid, skins) VALUES (?, ?, ?)",
      args: ["test-session-id", puuid, JSON.stringify(items)],
    });

    const result = await removeFromWishlist(puuid, "remove-me");

    expect(result.items).toHaveLength(1);
    expect(result.items[0].skinUuid).toBe("keep-me");
    expect(result.count).toBe(1);
  });

  it("handles removing from empty wishlist gracefully", async () => {
    const puuid = "test-puuid-remove-empty";

    const result = await removeFromWishlist(puuid, "non-existent-skin");

    expect(result.items).toHaveLength(0);
    expect(result.count).toBe(0);
  });

  it("handles removing non-existent item gracefully", async () => {
    const puuid = "test-puuid-remove-none";
    const items = [makeWishlistItem({ skinUuid: "keep-skin" })];

    // Pre-populate SQLite
    await testClient.execute({
      sql: "INSERT INTO wishlists (session_id, puuid, skins) VALUES (?, ?, ?)",
      args: ["test-session-id", puuid, JSON.stringify(items)],
    });

    const result = await removeFromWishlist(puuid, "non-existent-skin");

    // Should return the unchanged wishlist (1 item)
    expect(result.items).toHaveLength(1);
    expect(result.count).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Tests: error handling
// ---------------------------------------------------------------------------

describe("error handling", () => {
  it("handles getCurrentSessionId throwing gracefully", async () => {
    mockGetCurrentSessionId.mockRejectedValue(new Error("Session error"));
    const puuid = "test-puuid-session-error";

    const result = await getWishlist(puuid);

    expect(result.items).toHaveLength(0);
    expect(result.count).toBe(0);
  });

  it("handles initSessionDb throwing gracefully", async () => {
    mockInitSessionDb.mockRejectedValue(new Error("DB init error"));
    const puuid = "test-puuid-db-error";

    const result = await getWishlist(puuid);

    expect(result.items).toHaveLength(0);
    expect(result.count).toBe(0);
  });

  it("handles JSON parse error in cookie gracefully", async () => {
    const puuid = "test-puuid-parse-error";
    const cookieName = `valorant_wishlist_${puuid.substring(0, 8)}`;

    // SQLite returns empty (fresh in-memory)
    mockCookiesGet.mockReturnValue({ value: "invalid-json" });

    const result = await getWishlist(puuid);

    // Error is caught, returns empty array
    expect(result.items).toHaveLength(0);
    expect(result.count).toBe(0);
  });
});
