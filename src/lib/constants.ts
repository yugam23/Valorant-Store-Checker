/**
 * Shared constants for Valorant Store Checker.
 * Single source of truth for magic values used across multiple modules.
 */

// ---------------------------------------------------------------------------
// Riot Item Type UUIDs
// ---------------------------------------------------------------------------

export const ITEM_TYPE_WEAPON_SKIN  = "e7c63390-eda7-46e0-bb7a-a6abdacd2433";
export const ITEM_TYPE_BUDDY        = "dd3bf334-87f3-40bd-b043-682a57a8dc3a";
export const ITEM_TYPE_PLAYER_CARD  = "3f296c07-64c3-494c-923b-fe692a4fa1bd";
export const ITEM_TYPE_SPRAY        = "d5f120f8-ff8c-4571-a619-6040a92ab903";
export const ITEM_TYPE_PLAYER_TITLE = "de7caa6b-adf7-4588-bbd1-143831e786c6";
export const ITEM_TYPE_FLEX         = "03a572de-4234-31ed-d344-ababa488f981";

// ---------------------------------------------------------------------------
// Essential Riot Cookie Names (for session filtering)
// ---------------------------------------------------------------------------

export const ESSENTIAL_COOKIE_NAMES = new Set(["ssid", "clid", "csid", "tdid"]);

// ---------------------------------------------------------------------------
// Currency IDs — canonical source; re-exported from src/types/riot.ts
// ---------------------------------------------------------------------------

export const CURRENCY_IDS = {
  VP: "85ad13f7-3d1b-5128-9eb2-7cd8ee0b5741", // Valorant Points
  RP: "e59aa87c-4cbf-517a-5983-6e81511be9b7", // Radianite Points
  KC: "85ca954a-41f2-ce94-9b45-8ca3dd39a00d", // Kingdom Credits
} as const;

export type CurrencyType = keyof typeof CURRENCY_IDS;
