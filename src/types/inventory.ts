/**
 * Inventory type definitions
 * Defines types for user's owned weapon skins collection
 */

/**
 * Owned weapon skin (hydrated from entitlements)
 * Similar to StoreItem but without pricing fields
 */
export interface OwnedSkin {
  // Identity
  uuid: string; // Skin UUID
  displayName: string; // E.g., "Prime Vandal"

  // Visuals
  displayIcon: string; // Primary image URL
  streamedVideo: string | null; // Video preview URL (if available)
  wallpaper: string | null; // High-res background image

  // Rarity
  tierUuid: string | null; // Content tier UUID
  tierName: string | null; // E.g., "Select", "Deluxe", "Premium"
  tierColor: string; // Hex color for rarity indicator

  // Metadata
  chromaCount: number; // Number of color variants
  levelCount: number; // Number of upgrade levels
  assetPath: string; // Asset reference path
  weaponName: string; // E.g., "Vandal", "Phantom", "Melee"
}

/**
 * Complete inventory response
 */
/**
 * Edition/tier category for filter UI
 */
export interface EditionCategory {
  name: string;   // E.g., "Select", "Deluxe", "Premium"
  color: string;  // Hex color for the tier pill indicator
}

/**
 * Complete inventory response
 */
export interface InventoryData {
  skins: OwnedSkin[];
  totalCount: number;
  weaponCategories: string[];    // Unique weapon types for filtering
  editionCategories: EditionCategory[]; // Unique tiers for filtering
}
