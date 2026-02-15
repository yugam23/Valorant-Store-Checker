/**
 * Riot Inventory API Client
 *
 * Handles fetching player's owned weapon skins from Riot PD entitlements API.
 * Hydrates entitlements with asset data from Valorant-API.
 */

import { StoreTokens, fetchWithShardFallback } from "@/lib/riot-store";
import { getWeaponSkinsByLevelUuids, getContentTierByUuid } from "@/lib/valorant-api";
import { InventoryData, OwnedSkin, EditionCategory } from "@/types/inventory";
import { TIER_COLORS, DEFAULT_TIER_COLOR } from "@/types/store";
import { createLogger } from "./logger";

const log = createLogger("riot-inventory");

/**
 * Riot's internal ItemTypeID for weapon skins
 */
const ITEM_TYPE_WEAPON_SKIN = "e7c63390-eda7-46e0-bb7a-a6abdacd2433";

/**
 * In-memory cache for inventory data
 * Keyed by PUUID, expires after 5 minutes
 */
interface CacheEntry {
  data: InventoryData;
  fetchedAt: number;
}

const inventoryCache = new Map<string, CacheEntry>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Extracts weapon name from skin display name
 * E.g., "Prime Vandal" -> "Vandal", "Glitchpop Phantom" -> "Phantom"
 * Edge case: "Melee" skins don't have a weapon prefix (e.g., "Reaver Dagger")
 */
function extractWeaponName(displayName: string): string {
  // Edge case: if "melee" appears in the name, it's a melee weapon
  if (displayName.toLowerCase().includes("melee")) {
    return "Melee";
  }

  // Standard pattern: weapon name is the last word after the last space
  const words = displayName.trim().split(/\s+/);

  // If only one word, it's likely the weapon name itself
  if (words.length === 1) {
    return displayName;
  }

  // Extract the last word as the weapon name
  const weaponName = words[words.length - 1];

  // Special cases for common weapon names
  const knownWeapons = [
    "Vandal", "Phantom", "Operator", "Sheriff", "Ghost", "Frenzy",
    "Classic", "Shorty", "Marshal", "Guardian", "Bulldog", "Spectre",
    "Stinger", "Bucky", "Judge", "Ares", "Odin", "Knife", "Dagger",
    "Karambit", "Sword", "Axe", "Claws", "Butterfly", "Blade", "Scythe"
  ];

  // If the last word is a known weapon, return it
  if (knownWeapons.some(w => w.toLowerCase() === weaponName.toLowerCase())) {
    return weaponName;
  }

  // For melee weapons with special names (e.g., "Reaver Karambit"),
  // the last word is still the weapon type
  return weaponName;
}

/**
 * Fetches player's owned weapon skins from Riot PD entitlements API
 * and hydrates them with asset data from Valorant-API
 */
export async function getOwnedSkins(tokens: StoreTokens): Promise<InventoryData> {
  const now = Date.now();

  // Check cache first
  const cached = inventoryCache.get(tokens.puuid);
  if (cached && now - cached.fetchedAt < CACHE_TTL) {
    log.debug(`Serving cached inventory for PUUID: ${tokens.puuid.substring(0, 8)}`);
    return cached.data;
  }

  log.info(`Fetching entitlements for PUUID: ${tokens.puuid.substring(0, 8)}`);

  // Fetch entitlements from Riot PD API
  const response = await fetchWithShardFallback(tokens, (pdUrl) =>
    `${pdUrl}/store/v1/entitlements/${tokens.puuid}/${ITEM_TYPE_WEAPON_SKIN}`
  );

  const data = await response.json();
  log.debug("Entitlements response:", JSON.stringify(data).substring(0, 200));

  // Parse entitlements - handle both response formats
  let entitlements: Array<{ ItemID: string }> = [];

  if (data.EntitlementsByTypes) {
    // Format 1: { EntitlementsByTypes: [{ ItemTypeID, Entitlements: [...] }] }
    const weaponSkinEntitlements = data.EntitlementsByTypes.find(
      (e: { ItemTypeID: string }) => e.ItemTypeID === ITEM_TYPE_WEAPON_SKIN
    );
    entitlements = weaponSkinEntitlements?.Entitlements || [];
  } else if (data.Entitlements) {
    // Format 2: { Entitlements: [{ TypeID, ItemID }] }
    entitlements = data.Entitlements;
  }

  log.info(`Found ${entitlements.length} owned skins`);

  // Extract skin UUIDs
  const skinUuids = entitlements.map((e) => e.ItemID);

  if (skinUuids.length === 0) {
    const emptyData: InventoryData = {
      skins: [],
      totalCount: 0,
      weaponCategories: [],
      editionCategories: [],
    };
    inventoryCache.set(tokens.puuid, { data: emptyData, fetchedAt: now });
    return emptyData;
  }

  // Batch hydrate with Valorant-API data
  // Note: Riot entitlements API returns skin LEVEL UUIDs, not parent skin UUIDs
  log.debug(`Hydrating ${skinUuids.length} skin level entitlements from Valorant-API`);
  const skinsMap = await getWeaponSkinsByLevelUuids(skinUuids);

  log.info(`Matched ${skinsMap.size} entitlements to skins from Valorant-API`);

  // Build OwnedSkin objects (deduplicate since multiple levels map to same skin)
  const ownedSkins: OwnedSkin[] = [];
  const weaponNamesSet = new Set<string>();
  const editionMap = new Map<string, string>(); // tierName → tierColor
  const seenSkinUuids = new Set<string>();

  for (const uuid of skinUuids) {
    const skin = skinsMap.get(uuid.toLowerCase());

    // Skip if we already added this parent skin (dedup across level entitlements)
    if (skin && seenSkinUuids.has(skin.uuid.toLowerCase())) {
      continue;
    }

    if (!skin) {
      log.warn(`Skin not found in Valorant-API: ${uuid}`);
      continue;
    }

    // Mark this parent skin as seen
    seenSkinUuids.add(skin.uuid.toLowerCase());

    // Get tier information
    const tier = skin.contentTierUuid
      ? await getContentTierByUuid(skin.contentTierUuid)
      : null;

    const tierColor = tier
      ? (TIER_COLORS[tier.displayName] || `#${tier.highlightColor.slice(0, 6)}`)
      : DEFAULT_TIER_COLOR;

    // Extract weapon name
    const weaponName = extractWeaponName(skin.displayName);
    weaponNamesSet.add(weaponName);

    // Track edition/tier category
    if (tier?.displayName) {
      editionMap.set(tier.displayName, tierColor);
    }

    // Get best video from levels
    let streamedVideo: string | null = null;
    if (skin.levels && skin.levels.length > 0) {
      for (let i = skin.levels.length - 1; i >= 0; i--) {
        if (skin.levels[i].streamedVideo) {
          streamedVideo = skin.levels[i].streamedVideo;
          break;
        }
      }
    }

    ownedSkins.push({
      uuid: skin.uuid,
      displayName: skin.displayName,
      displayIcon: skin.levels?.[0]?.displayIcon || skin.displayIcon || "",
      streamedVideo,
      wallpaper: skin.wallpaper,
      tierUuid: tier?.uuid || null,
      tierName: tier?.displayName || null,
      tierColor,
      chromaCount: skin.chromas.length,
      levelCount: skin.levels.length,
      assetPath: skin.assetPath,
      weaponName,
    });
  }

  // Sort by weapon name, then by skin name
  ownedSkins.sort((a, b) => {
    if (a.weaponName !== b.weaponName) {
      return a.weaponName.localeCompare(b.weaponName);
    }
    return a.displayName.localeCompare(b.displayName);
  });

  // Sort weapon categories alphabetically
  const weaponCategories = Array.from(weaponNamesSet).sort();

  // Build edition categories ordered by rarity hierarchy
  const EDITION_ORDER = ["Select Edition", "Deluxe Edition", "Premium Edition", "Exclusive Edition", "Ultra Edition"];
  const editionCategories: EditionCategory[] = EDITION_ORDER
    .filter((name) => editionMap.has(name))
    .map((name) => ({ name, color: editionMap.get(name)! }));
  // Append any editions not in the predefined order
  for (const [name, color] of editionMap) {
    if (!EDITION_ORDER.includes(name)) {
      editionCategories.push({ name, color });
    }
  }

  const inventoryData: InventoryData = {
    skins: ownedSkins,
    totalCount: ownedSkins.length,
    weaponCategories,
    editionCategories,
  };

  // Cache the result
  inventoryCache.set(tokens.puuid, { data: inventoryData, fetchedAt: now });
  
  // Persist to central cache for API fallback
  const { setCachedInventory } = await import("./inventory-cache");
  setCachedInventory(tokens.puuid, inventoryData);

  log.info(`Successfully hydrated ${ownedSkins.length} skins across ${weaponCategories.length} weapon types`);

  return inventoryData;
}
