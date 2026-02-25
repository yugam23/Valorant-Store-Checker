/**
 * Wishlist Persistence Module
 *
 * Manages per-account wishlist storage in cookies.
 * Each account's wishlist is stored separately using PUUID-based cookie keys.
 *
 * Storage strategy:
 * - Cookie-based persistence (survives browser restarts)
 * - Per-account isolation (cookie key includes PUUID prefix)
 * - httpOnly: true for security (client can't access directly)
 * - Max 50 items per wishlist (prevent cookie bloat)
 */

import { cookies } from "next/headers";
import type { WishlistData, WishlistItem, WishlistMatchResult } from "@/types/wishlist";
import { createLogger } from "@/lib/logger";
const log = createLogger("wishlist");

const WISHLIST_COOKIE_PREFIX = "valorant_wishlist_";
const WISHLIST_MAX_ITEMS = 50;
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
 * @param puuid Account PUUID
 * @returns Wishlist data with items and count
 */
export async function getWishlist(puuid: string): Promise<WishlistData> {
  try {
    const cookieStore = await cookies();
    const cookieName = getWishlistCookieName(puuid);
    const cookieValue = cookieStore.get(cookieName)?.value;

    if (!cookieValue) {
      return { items: [], count: 0 };
    }

    const items: WishlistItem[] = JSON.parse(cookieValue);
    return {
      items,
      count: items.length,
    };
  } catch (error) {
    log.error("Error reading wishlist cookie:", error);
    return { items: [], count: 0 };
  }
}

/**
 * Add item to wishlist (with deduplication)
 * @param puuid Account PUUID
 * @param item Wishlist item to add
 * @returns Updated wishlist data
 */
export async function addToWishlist(
  puuid: string,
  item: WishlistItem
): Promise<WishlistData> {
  const current = await getWishlist(puuid);

  // Check if already wishlisted
  const alreadyExists = current.items.some(
    (existing) => existing.skinUuid === item.skinUuid
  );

  if (alreadyExists) {
    return current;
  }

  // Check max items limit
  if (current.items.length >= WISHLIST_MAX_ITEMS) {
    throw new Error(
      `Wishlist full. Maximum ${WISHLIST_MAX_ITEMS} items allowed.`
    );
  }

  // Add new item at the beginning (most recent first)
  const updated: WishlistItem[] = [item, ...current.items];

  // Write to cookie
  const cookieStore = await cookies();
  const cookieName = getWishlistCookieName(puuid);
  const isProduction = process.env.NODE_ENV === "production";

  cookieStore.set(cookieName, JSON.stringify(updated), {
    httpOnly: true,
    secure: isProduction,
    sameSite: "lax",
    maxAge: COOKIE_MAX_AGE,
    path: "/",
  });

  return {
    items: updated,
    count: updated.length,
  };
}

/**
 * Remove item from wishlist
 * @param puuid Account PUUID
 * @param skinUuid UUID of skin to remove
 * @returns Updated wishlist data
 */
export async function removeFromWishlist(
  puuid: string,
  skinUuid: string
): Promise<WishlistData> {
  const current = await getWishlist(puuid);

  // Filter out the item
  const updated = current.items.filter((item) => item.skinUuid !== skinUuid);

  // Write to cookie
  const cookieStore = await cookies();
  const cookieName = getWishlistCookieName(puuid);
  const isProduction = process.env.NODE_ENV === "production";

  if (updated.length === 0) {
    // Delete cookie if wishlist is empty
    cookieStore.delete(cookieName);
  } else {
    cookieStore.set(cookieName, JSON.stringify(updated), {
      httpOnly: true,
      secure: isProduction,
      sameSite: "lax",
      maxAge: COOKIE_MAX_AGE,
      path: "/",
    });
  }

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
