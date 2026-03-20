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
const COOKIE_MAX_AGE = 365 * 24 * 60 * 60; // 1 year in seconds

/**
 * Get the cookie name for a specific account's wishlist
 * Uses first 8 chars of PUUID to create unique key
 */
function getWishlistCookieName(puuid: string): string {
  const puuidPrefix = puuid.substring(0, 8);
  return `${WISHLIST_COOKIE_PREFIX}${puuidPrefix}`;
}

/**
 * Get wishlist for the active account
 * SQLite-first: reads from SQLite, falls back to legacy cookie on miss,
 * and migrates the cookie data to SQLite atomically.
 * @param puuid Account PUUID
 * @returns Wishlist data with items and count
 */
export async function getWishlist(puuid: string): Promise<WishlistData> {
  try {
    // 1. Get session ID
    const sessionId = await getCurrentSessionId();
    if (!sessionId) {
      return { items: [], count: 0 };
    }

    // 2. Read from SQLite first
    const db = await initSessionDb();
    const result = await db.execute({
      sql: "SELECT skins FROM wishlists WHERE session_id = ? AND puuid = ?",
      args: [sessionId, puuid],
    });

    if (result.rows.length > 0) {
      const skinsJson = result.rows[0]!.skins as string;
      const items: WishlistItem[] = JSON.parse(skinsJson);
      return { items, count: items.length };
    }

    // 3. Fallback to legacy cookie
    const cookieStore = await cookies();
    const cookieName = getWishlistCookieName(puuid);
    const cookieValue = cookieStore.get(cookieName)?.value;

    if (!cookieValue) {
      return { items: [], count: 0 };
    }

    // 4. Migrate to SQLite atomically
    const items: WishlistItem[] = JSON.parse(cookieValue);
    const skinsJson = JSON.stringify(items);

    await db.execute({
      sql: `INSERT INTO wishlists (session_id, puuid, skins) VALUES (?, ?, ?)
            ON CONFLICT(session_id, puuid) DO UPDATE SET skins = excluded.skins`,
      args: [sessionId, puuid, skinsJson],
    });

    // 5. Delete legacy cookie ONLY after successful write
    cookieStore.delete(cookieName);

    return { items, count: items.length };
  } catch (error) {
    log.error("Error reading wishlist:", error);
    return { items: [], count: 0 };
  }
}

/**
 * Add item to wishlist (with deduplication)
 * Reads from SQLite (with cookie fallback), writes SQLite only.
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

  const db = await initSessionDb();

  // Read current from SQLite (not cookies)
  const result = await db.execute({
    sql: "SELECT skins FROM wishlists WHERE session_id = ? AND puuid = ?",
    args: [sessionId, puuid],
  });

  let items: WishlistItem[];
  if (result.rows.length > 0) {
    items = JSON.parse(result.rows[0]!.skins as string);
  } else {
    // Check legacy cookie as a fallback for initial migration scenario
    const cookieStore = await cookies();
    const cookieName = getWishlistCookieName(puuid);
    const cookieValue = cookieStore.get(cookieName)?.value;
    if (cookieValue) {
      items = JSON.parse(cookieValue);
    } else {
      items = [];
    }
  }

  // Check if already wishlisted
  const alreadyExists = items.some(
    (existing) => existing.skinUuid === item.skinUuid
  );

  if (alreadyExists) {
    return { items, count: items.length };
  }

  // Add new item at the beginning (most recent first) - NO CAP
  const updated: WishlistItem[] = [item, ...items];

  // Write to SQLite only
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
 * Reads from SQLite (with cookie fallback), writes SQLite only.
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

  const db = await initSessionDb();

  // Read current from SQLite
  const result = await db.execute({
    sql: "SELECT skins FROM wishlists WHERE session_id = ? AND puuid = ?",
    args: [sessionId, puuid],
  });

  let items: WishlistItem[];
  if (result.rows.length > 0) {
    items = JSON.parse(result.rows[0]!.skins as string);
  } else {
    // Fallback to cookie for migration edge case
    const cookieStore = await cookies();
    const cookieName = getWishlistCookieName(puuid);
    const cookieValue = cookieStore.get(cookieName)?.value;
    if (cookieValue) {
      items = JSON.parse(cookieValue);
    } else {
      items = [];
    }
  }

  // Filter out the item
  const updated = items.filter((item) => item.skinUuid !== skinUuid);

  // Write to SQLite only
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
