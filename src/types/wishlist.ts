/**
 * Wishlist type definitions
 *
 * Supports per-account wishlist tracking for desired weapon skins.
 */

/**
 * Individual wishlist item
 */
export interface WishlistItem {
  skinUuid: string;
  displayName: string;
  displayIcon: string;
  tierColor: string;
  addedAt: string; // ISO date string
}

/**
 * Complete wishlist data structure
 */
export interface WishlistData {
  items: WishlistItem[];
  count: number;
}

/**
 * Result of checking which wishlisted skins are currently in the store
 */
export interface WishlistMatchResult {
  skinUuid: string;
  displayName: string;
  isInStore: boolean;
}
