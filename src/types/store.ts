/**
 * Unified store types for frontend consumption
 * These are hydrated versions combining Riot API data with Valorant-API assets
 */

import { CURRENCY_IDS } from "./riot";

/**
 * Hydrated store item ready for display
 * Combines Riot Store API offer with Valorant-API asset data
 */
export interface StoreItem {
  // Identity
  uuid: string; // Skin UUID from Riot API
  displayName: string; // E.g., "Prime Vandal"

  // Visuals
  displayIcon: string; // Primary image URL
  streamedVideo: string | null; // Video preview URL (if available)
  wallpaper: string | null; // High-res background image

  // Pricing
  cost: number; // Price in VP
  currencyId: string; // Usually VP currency ID

  // Rarity
  tierUuid: string | null; // Content tier UUID
  tierName: string | null; // E.g., "Select", "Deluxe", "Premium"
  tierColor: string; // Hex color for rarity indicator (e.g., "#edd65a")

  // Metadata
  chromaCount: number; // Number of color variants
  levelCount: number; // Number of upgrade levels
  assetPath: string; // Asset reference path
}

/**
 * Complete store response with all daily items
 */
export interface StoreData {
  items: StoreItem[]; // Daily 4 items
  expiresAt: Date; // When the store resets
  wallet?: WalletBalance; // Optional wallet data
}

/**
 * Player wallet balances
 */
export interface WalletBalance {
  vp: number; // Valorant Points
  rp: number; // Radianite Points
  kc?: number; // Kingdom Credits (if fetched)
}

/**
 * Night Market bonus store item (with discount)
 */
export interface NightMarketItem extends Omit<StoreItem, "cost"> {
  basePrice: number; // Original price
  discountedPrice: number; // Price after discount
  discountPercent: number; // Discount percentage (0-100)
  isSeen: boolean; // Whether user has revealed this item
}

/**
 * Night Market data structure
 */
export interface NightMarketData {
  items: NightMarketItem[];
  expiresAt: Date;
}

/**
 * Loading states for store data
 */
export type StoreLoadingState = "idle" | "loading" | "success" | "error";

/**
 * Store error types
 */
export interface StoreError {
  code: "UNAUTHORIZED" | "RIOT_API_ERROR" | "HYDRATION_ERROR" | "NETWORK_ERROR" | "UNKNOWN";
  message: string;
  details?: unknown;
}

/**
 * Store fetch options
 */
export interface StoreFetchOptions {
  includeWallet?: boolean;
  includeNightMarket?: boolean;
}

/**
 * Rarity tier configuration for UI display
 */
export const TIER_COLORS: Record<string, string> = {
  // Based on Valorant content tiers
  Select: "#5A9FE2", // Blue
  Deluxe: "#00C7B7", // Cyan
  Premium: "#D1548D", // Pink
  Exclusive: "#F0B232", // Gold/Yellow
  Ultra: "#EFEB65", // Bright Yellow
};

/**
 * Default tier color for items without a tier
 */
export const DEFAULT_TIER_COLOR = "#71717A"; // Zinc-500
