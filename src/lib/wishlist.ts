/**
 * Wishlist Persistence Module
 *
 * Manages per-account wishlist storage using SQLite with cookie fallback migration.
 * Each account's wishlist is stored separately using PUUID-based cookie keys during
 * the transition window.
 *
 * Storage strategy:
 * - SQLite-first persistence (session-db.ts wishlists table)
 * - Cookie fallback for legacy migration (Phase B deferred)
 * - Per-account isolation (cookie key includes PUUID prefix)
 * - No item cap (SQLite has no practical per-user limit)
 */

import { cookies } from "next/headers";
import type { WishlistData, WishlistItem, WishlistMatchResult } from "@/types/wishlist";
import { createLogger } from "@/lib/logger";
import { getCurrentSessionId } from "@/lib/session";
import { initSessionDb } from "@/lib/session-db";
const log = createLogger("wishlist");

const WISHLIST_COOKIE_PREFIX = "valorant_wishlist_";

/**
 * Get the cookie name for a specific account's wishlist
 * Uses first 8 chars of PUUID to create unique key
 */
function getWishlistCookieName(puuid: string): string {
  const puuidPrefix = puuid.substring(0, 8);
  return `${WISHLIST_COOKIE_PREFIX}${puuidPrefix}`;
}

/**
 * Read wishlist items from storage (SQLite-first with cookie fallback)
 *
 * This helper ONLY reads - it does not write to SQLite.
 * The calling functions (addToWishlist, removeFromWishlist) handle writes.
 *
 * @param puuid Account PUUID
 * @returns Promise resolving to array of wishlist items (empty on any error)
 */
async function readWishlistItems(puuid: string): Promise<WishlistItem[]> {
  try {
    // 1. Get session ID
    const sessionId = await getCurrentSessionId();
    if (!sessionId) {
      return [];
    }

    // 2. Read from SQLite first
    const db = await initSessionDb();
    const result = await db.execute({
      sql: "SELECT skins FROM wishlists WHERE session_id = ? AND puuid = ?",
      args: [sessionId, puuid],
    });

    if (result.rows.length > 0) {
      const skinsJson = result.rows[0]!.skins as string;
      log.debug(`Wishlist read from SQLite for ${puuid}`);
      return JSON.parse(skinsJson);
    }

    // 3. SQLite miss - fall back to cookie
    log.debug(`SQLite miss, falling back to cookie for ${puuid}`);
    const cookieStore = await cookies();
    const cookieName = getWishlistCookieName(puuid);
    const cookieValue = cookieStore.get(cookieName)?.value;

    if (!cookieValue) {
      return [];
    }

    // 4. Cookie exists - migrate to SQLite atomically
    const items: WishlistItem[] = JSON.parse(cookieValue);
    const skinsJson = JSON.stringify(items);

    await db.execute({
      sql: `INSERT INTO wishlists (session_id, puuid, skins) VALUES (?, ?, ?)
            ON CONFLICT(session_id, puuid) DO UPDATE SET skins = excluded.skins`,
      args: [sessionId, puuid, skinsJson],
    });

    // 5. Delete legacy cookie ONLY after successful write
    cookieStore.delete(cookieName);

    return items;
  } catch (error) {
    log.error("Error reading wishlist items:", error);
    return [];
  }
}

/**
 * Get wishlist for the active account
 * Uses readWishlistItems() helper for SQLite-first, cookie fallback reading.
 * @param puuid Account PUUID
 * @returns Wishlist data with items and count
 */
export async function getWishlist(puuid: string): Promise<WishlistData> {
  try {
    const items = await readWishlistItems(puuid);
    return { items, count: items.length };
  } catch (error) {
    log.error("Error reading wishlist:", error);
    return { items: [], count: 0 };
  }
}

/**
 * Add item to wishlist (with deduplication)
 * Uses readWishlistItems() helper for reading, writes SQLite only.
 * @param puuid Account PUUID
 * @param item Wishlist item to add
 * @returns Updated wishlist data
 */
export async function addToWishlist(
  puuid: string,
  item: WishlistItem
): Promise<WishlistData> {
  const sessionId = await getCurrentSessionId();
  if (!sessionId) {
    return { items: [], count: 0 };
  }

  // Read current wishlist items using helper (handles SQLite+cookie fallback)
  const items = await readWishlistItems(puuid);

  // Check if already wishlisted
  const alreadyExists = items.some(
    (existing) => existing.skinUuid === item.skinUuid
  );

  if (alreadyExists) {
    return { items, count: items.length };
  }

  // Add new item at the beginning (most recent first) - NO CAP
  const updated: WishlistItem[] = [item, ...items];

  // Write to SQLite
  const db = await initSessionDb();
  await db.execute({
    sql: `INSERT INTO wishlists (session_id, puuid, skins) VALUES (?, ?, ?)
          ON CONFLICT(session_id, puuid) DO UPDATE SET skins = excluded.skins`,
    args: [sessionId, puuid, JSON.stringify(updated)],
  });

  return {
    items: updated,
    count: updated.length,
  };
}

/**
 * Remove item from wishlist
 * Uses readWishlistItems() helper for reading, writes SQLite only.
 * @param puuid Account PUUID
 * @param skinUuid UUID of skin to remove
 * @returns Updated wishlist data
 */
export async function removeFromWishlist(
  puuid: string,
  skinUuid: string
): Promise<WishlistData> {
  const sessionId = await getCurrentSessionId();
  if (!sessionId) {
    return { items: [], count: 0 };
  }

  // Read current wishlist items using helper (handles SQLite+cookie fallback)
  const items = await readWishlistItems(puuid);

  // Filter out the item
  const updated = items.filter((item) => item.skinUuid !== skinUuid);

  // Write to SQLite
  const db = await initSessionDb();
  await db.execute({
    sql: `INSERT INTO wishlists (session_id, puuid, skins) VALUES (?, ?, ?)
          ON CONFLICT(session_id, puuid) DO UPDATE SET skins = excluded.skins`,
    args: [sessionId, puuid, JSON.stringify(updated)],
  });

  return {
    items: updated,
    count: updated.length,
  };
}

/**
 * Check if a specific skin is wishlisted
 * @param puuid Account PUUID
 * @param skinUuid Skin UUID to check
 * @returns True if wishlisted
 */
export async function isWishlisted(
  puuid: string,
  skinUuid: string
): Promise<boolean> {
  const wishlist = await getWishlist(puuid);
  return wishlist.items.some((item) => item.skinUuid === skinUuid);
}

/**
 * Check which wishlisted skins are currently in the daily store
 * @param puuid Account PUUID
 * @param storeItemUuids Array of skin UUIDs currently in the store
 * @returns Array of match results showing which wishlisted skins are in store
 */
export async function checkWishlistInStore(
  puuid: string,
  storeItemUuids: string[]
): Promise<WishlistMatchResult[]> {
  const wishlist = await getWishlist(puuid);

  // Normalize store UUIDs to lowercase for case-insensitive comparison
  const normalizedStoreUuids = storeItemUuids.map((uuid) => uuid.toLowerCase());

  return wishlist.items.map((item) => ({
    skinUuid: item.skinUuid,
    displayName: item.displayName,
    isInStore: normalizedStoreUuids.includes(item.skinUuid.toLowerCase()),
  }));
}
